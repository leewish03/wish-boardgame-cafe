import { randomBytes } from 'node:crypto';
import { roomRepository } from './RoomRepository.js';
import { broadcastRoomState, rooms } from '../shared/roomManager.js';
import * as nimmt from '../../packages/six-nimmt-core/src/index.js';
import * as whitechapel from '../../packages/whitechapel-core/src/index.js';
import * as whitehall from '../../packages/whitehall-core/src/index.js';

export const boardGameCores = { SIX_NIMMT: nimmt, WHITECHAPEL: whitechapel, WHITEHALL: whitehall };

export class BoardGameService {
  constructor(io) { this.io = io; this.queues = new Map(); this.timers = new Map(); this.pauseTimers = new Map(); }
  runExclusive(code, operation) {
    const current = (this.queues.get(code) || Promise.resolve()).catch(() => {}).then(operation);
    this.queues.set(code, current);
    const cleanup = () => { if (this.queues.get(code) === current) this.queues.delete(code); };
    current.then(cleanup, cleanup);
    return current;
  }
  clearTimers(code) { clearTimeout(this.timers.get(code)); this.timers.delete(code); }
  clearPauseTimer(code) { clearTimeout(this.pauseTimers.get(code)); this.pauseTimers.delete(code); }
  syncRoom(room, state) {
    room.gameStateObject = state;
    room.gameState = state.matchState; room.playPhase = state.playPhase;
    room.stateVersion = state.stateVersion; room.roundNumber = state.roundNumber;
    for (const player of state.players) {
      const member = room.players.find(p => p.id === player.id);
      player.isHost = player.id === room.hostId;
      if (member) player.isBot = !!member.isBot;
    }
  }
  async startMatch(code, hostId) {
    return this.runExclusive(code, async () => {
      const room = await roomRepository.getRoom(code), core = boardGameCores[room?.gameType];
      if (!core) throw new Error('게임 방을 찾을 수 없습니다.');
      if (room.hostId !== hostId) throw new Error('방장만 게임을 시작할 수 있습니다.');
      if (room.isPaused) throw new Error('재접속을 기다리는 중입니다.');
      if (room.players.length < core.minPlayers || room.players.length > core.maxPlayers) throw new Error(`${core.minPlayers}~${core.maxPlayers}명이 필요합니다.`);
      if (room.players.some(p => !p.isBot && (p.isDisconnected || (p.id !== hostId && !p.isReady)))) throw new Error('모두 준비 완료해야 합니다.');
      if (room.gameStateObject && room.gameStateObject.matchState !== 'GAME_OVER') throw new Error('이미 시작한 게임입니다.');
      const players = room.players.map(p => ({ id: p.id, nickname: p.nickname, isBot: !!p.isBot, isHost: p.id === hostId }));
      const jackPlayerId = room.hostRole === 'INVESTIGATOR' ? players.find(p => p.id !== hostId).id : hostId;
      const entropy = randomBytes(32);
      const seed = room.gameType === 'SIX_NIMMT' ? entropy.toString('hex') : entropy.readUInt32BE(0);
      const state = core.createInitialState(players, { jackPlayerId, turnTimeoutSeconds: room.turnTimeLimit }, seed);
      state.stateVersion = Math.max(room.stateVersion || 0, room.gameStateObject?.stateVersion || 0);
      await this.commit(room, core.executeCommand(state, { type: 'START_MATCH', playerId: hostId }));
      return { success: true, stateVersion: room.stateVersion };
    });
  }
  async handleCommand(code, command) {
    return this.runExclusive(code, async () => {
      const room = await roomRepository.getRoom(code), core = boardGameCores[room?.gameType];
      if (!core || !room.gameStateObject) throw new Error('진행 중인 게임이 없습니다.');
      if (!core.allowedCommands.includes(command.type) || command.type === 'START_MATCH') throw new Error('허용되지 않는 명령입니다.');
      if (!room.players.some(p => p.id === command.playerId && !p.isBot)) throw new Error('참가자를 확인해 주세요.');
      if (command.type === 'ADVANCE_ROUND' && command.playerId !== room.hostId) throw new Error('방장만 다음 라운드를 시작할 수 있습니다.');
      this.requireAvailable(room);
      const state = room.gameStateObject;
      const selection = room.gameType === 'SIX_NIMMT' && command.type === 'SELECT_CARD' && state.playPhase === 'SELECTING';
      if (!Number.isInteger(command.expectedVersion) || (!selection && command.expectedVersion !== state.stateVersion)) throw new Error('지난 상태의 요청입니다.');
      await this.commit(room, core.executeCommand(state, command));
      return { success: true, stateVersion: room.stateVersion };
    });
  }
  requireAvailable(room) {
    if (room.isPaused) throw new Error('재접속을 기다리는 중입니다.');
    if (room.boardPresentationGate) throw new Error('이전 행동을 테이블에 표시하는 중입니다.');
  }
  async commit(room, { nextState, events }) {
    const previous = room.gameStateObject;
    const candidate = { ...room };
    this.syncRoom(candidate, nextState);
    // A face-down commitment has no moving object and must not lock other selectors.
    const selectionOnly = room.gameType === 'SIX_NIMMT' && nextState.playPhase === 'SELECTING' && previous?.selectionVersion === nextState.selectionVersion;
    const waitingFor = room.players.filter(p => !p.isBot && p.socketId && !p.isDisconnected).map(p => p.id);
    if (events.length && !selectionOnly && waitingFor.length) {
      candidate.boardPresentationGate = { id: `${nextState.stateVersion}:batch`, events, waitingFor, acknowledged: [], fallbackAt: Date.now() + 8000 };
    } else candidate.boardPresentationGate = null;
    if (!selectionOnly) candidate.boardTurnExpiresAt = room.turnTimeLimit > 0 ? Date.now() + room.turnTimeLimit * 1000 : 0;
    const { gameStateObject, gameState, playPhase, stateVersion, roundNumber, boardPresentationGate, boardTurnExpiresAt } = candidate;
    await roomRepository.saveRoom(room, { gameStateObject, gameState, playPhase, stateVersion, roundNumber, boardPresentationGate, boardTurnExpiresAt });
    broadcastRoomState(this.io, room.code, false);
    this.schedule(room.code);
  }
  projectRoomState(room, userId) {
    const core = boardGameCores[room.gameType], game = core.getPublicView(room.gameStateObject);
    game.players = game.players.map(p => ({ ...p, isHost: p.id === room.hostId, isDisconnected: !!room.players.find(m => m.id === p.id)?.isDisconnected }));
    const gate = room.boardPresentationGate;
    const events = gate ? (core.projectEvents ? core.projectEvents(gate.events, userId) : gate.events.filter(event => !event.recipientId)) : [];
    return { code: room.code, gameType: room.gameType, hostId: room.hostId, hostRole: room.hostRole,
      gameState: game.matchState, playPhase: game.playPhase, stateVersion: game.stateVersion, serverTime: Date.now(),
      minPlayers: core.minPlayers, maxPlayers: room.maxPlayers, turnTimeLimit: room.turnTimeLimit,
      turnExpiresAt: room.boardTurnExpiresAt || 0, roundNumber: game.roundNumber,
      isPaused: !!room.isPaused, pausedPlayerId: room.pausedPlayerId || null, pauseExpiresAt: room.pauseExpiresAt || null,
      players: game.players, game, mySecret: core.getPrivateView(room.gameStateObject, userId),
      presentation: { id: gate?.id || null, events, pending: !!gate, fallbackAt: gate?.fallbackAt || null },
      chatMessages: (room.chatMessages || []).slice(-30) };
  }
  async acknowledgePresentation(code, userId, eventId) {
    return this.runExclusive(code, async () => {
      const room = await roomRepository.getRoom(code), gate = room?.boardPresentationGate;
      if (!gate || gate.id !== eventId || !gate.waitingFor.includes(userId)) return { success: true };
      const acknowledged = [...new Set([...gate.acknowledged, userId])];
      if (gate.waitingFor.every(id => acknowledged.includes(id))) await this.releasePresentation(room);
      else await roomRepository.saveRoom(room, { boardPresentationGate: { ...gate, acknowledged } });
      return { success: true };
    });
  }
  async releasePresentation(room) {
    await roomRepository.saveRoom(room, { boardPresentationGate: null,
      boardTurnExpiresAt: room.turnTimeLimit > 0 ? Date.now() + room.turnTimeLimit * 1000 : 0 });
    broadcastRoomState(this.io, room.code, false); this.schedule(room.code);
  }
  schedule(code, retry = 0) {
    this.clearTimers(code);
    const room = rooms[code], core = boardGameCores[room?.gameType];
    if (!core || !room.gameStateObject || room.isPaused) return;
    const state = room.gameStateObject, gate = room.boardPresentationGate;
    let delay;
    if (gate) delay = Math.max(1, gate.fallbackAt - Date.now());
    else if (state.matchState !== 'PLAYING') return;
    else if (core.getAutomaticCommand?.(state)) delay = 30;
    else if (core.getPendingActors(state).some(id => room.players.find(p => p.id === id)?.isBot)) delay = 600;
    else if (room.boardTurnExpiresAt) delay = Math.max(1, room.boardTurnExpiresAt - Date.now());
    else return;
    if (retry) delay = Math.max(delay, 1000 * 2 ** (retry - 1));
    const version = state.stateVersion;
    const timer = setTimeout(() => {
      this.timers.delete(code);
      void this.runScheduled(code, version).catch(error => {
        console.error('Board game scheduling failed:', error.message);
        if (retry < 3 && rooms[code]?.gameStateObject?.stateVersion === version && !this.timers.has(code)) this.schedule(code, retry + 1);
      });
    }, delay);
    timer.unref?.(); this.timers.set(code, timer);
  }
  async runScheduled(code, version) {
    return this.runExclusive(code, async () => {
      const room = await roomRepository.getRoom(code), core = boardGameCores[room?.gameType];
      if (!core || room.isPaused || room.gameStateObject?.stateVersion !== version) return;
      if (room.boardPresentationGate) { await this.releasePresentation(room); return; }
      const state = room.gameStateObject;
      if (state.matchState !== 'PLAYING') return;
      let command = core.getAutomaticCommand?.(state);
      if (!command) {
        const pending = core.getPendingActors(state);
        const id = pending.find(id => room.players.find(p => p.id === id)?.isBot)
          || (room.boardTurnExpiresAt && room.boardTurnExpiresAt <= Date.now() ? pending[0] : null);
        if (!id) return;
        command = core.chooseBotCommand(core.getBotObservation(state, id), id);
        if (command) command = { ...command, playerId: id };
      }
      if (command) await this.commit(room, core.executeCommand(state, { ...command, expectedVersion: version }));
    });
  }
  async pauseRoom(code, playerId) {
    return this.runExclusive(code, async () => {
      const room = await roomRepository.getRoom(code);
      if (!room?.gameStateObject) return;
      if (!room.isPaused) {
        room.pausedTurnRemainingMs = Math.max(0, (room.boardTurnExpiresAt || Date.now()) - Date.now());
        room.isPaused = true; room.pausedPlayerId = playerId; room.pauseExpiresAt = Date.now() + 90_000;
      }
      this.clearTimers(code); room.boardPresentationGate = null;
      await roomRepository.saveRoom(room); this.schedulePause(room); broadcastRoomState(this.io, code);
    });
  }
  schedulePause(room) {
    this.clearPauseTimer(room.code);
    if (!room.isPaused) return;
    const timer = setTimeout(() => { void this.disconnectExpired(room.code).catch(error => console.error('Board reconnect expiry:', error.message)); }, Math.max(1, room.pauseExpiresAt - Date.now()));
    timer.unref?.(); this.pauseTimers.set(room.code, timer);
  }
  async resumeRoom(code) {
    return this.runExclusive(code, async () => {
      const room = await roomRepository.getRoom(code);
      if (!room?.gameStateObject) return;
      if (room.players.some(p => !p.isBot && p.isDisconnected)) { this.schedulePause(room); return; }
      await this.resumeUnlocked(room);
    });
  }
  async resumeUnlocked(room) {
    this.clearPauseTimer(room.code);
    if (room.isPaused) room.boardTurnExpiresAt = room.turnTimeLimit > 0 ? Date.now() + (room.pausedTurnRemainingMs ?? room.turnTimeLimit * 1000) : 0;
    room.isPaused = false; room.pausedPlayerId = null; room.pauseExpiresAt = null;
    delete room.pausedTurnRemainingMs;
    this.syncRoom(room, room.gameStateObject);
    await roomRepository.saveRoom(room); broadcastRoomState(this.io, room.code); this.schedule(room.code);
  }
  takeOver(room, player) {
    player.isBot = true; player.takenOverByBot = true; player.isDisconnected = false; player.socketId = null;
    if (room.hostId === player.id) room.hostId = room.players.find(p => !p.isBot)?.id || room.hostId;
    if (room.boardPresentationGate) room.boardPresentationGate.waitingFor = room.boardPresentationGate.waitingFor.filter(id => id !== player.id);
    room.gameStateObject.stateVersion++;
    this.syncRoom(room, room.gameStateObject);
  }
  async deleteIfNoHumans(room) {
    if (room.players.some(p => !p.isBot)) return false;
    this.clearTimers(room.code); this.clearPauseTimer(room.code);
    await roomRepository.deleteRoom(room.code);
    this.io.to(room.code).emit('room:unavailable', { error: '모든 참가자가 퇴장했습니다.' });
    return true;
  }
  async disconnectExpired(code) {
    return this.runExclusive(code, async () => {
      const room = await roomRepository.getRoom(code);
      if (!room?.isPaused || room.pauseExpiresAt > Date.now()) return;
      room.players.filter(p => !p.isBot && p.isDisconnected).forEach(p => this.takeOver(room, p));
      if (!(await this.deleteIfNoHumans(room))) await this.resumeUnlocked(room);
    });
  }
  async finalizeDeparture(code, playerId) {
    return this.runExclusive(code, async () => {
      const room = await roomRepository.getRoom(code);
      if (!room?.gameStateObject) return { retainSeat: false };
      const player = room.players.find(p => p.id === playerId);
      if (player && !player.isBot) this.takeOver(room, player);
      if (await this.deleteIfNoHumans(room)) return { retainSeat: true, roomDeleted: true };
      if (room.isPaused && room.players.some(p => !p.isBot && p.isDisconnected)) {
        await roomRepository.saveRoom(room); this.schedulePause(room); broadcastRoomState(this.io, code);
      } else if (room.boardPresentationGate?.waitingFor.every(id => room.boardPresentationGate.acknowledged.includes(id))) await this.releasePresentation(room);
      else await this.resumeUnlocked(room);
      return { retainSeat: true };
    });
  }
  async restoreRooms() {
    for (const room of await roomRepository.listRooms()) {
      if (!boardGameCores[room.gameType] || !room.gameStateObject) continue;
      room.boardPresentationGate = null;
      if (room.isPaused) { room.pauseExpiresAt ||= Date.now() + 90_000; this.schedulePause(room); }
      await roomRepository.saveRoom(room); this.schedule(room.code);
    }
  }
}
export const createBoardGameService = io => new BoardGameService(io);
