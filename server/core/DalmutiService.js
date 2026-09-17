import { roomRepository } from './RoomRepository.js';
import { broadcastRoomState } from '../shared/roomManager.js';
import * as core from '../../packages/dalmuti-core/src/index.js';

const BOT_DELAY_MS = 520;
const PRESENTATION_FALLBACK_MS = 900;
const PRESENTATION_EVENT_TYPES = new Set(['SET_PLAYED', 'PASSED', 'TRICK_CLEARED', 'TAX_COMPLETED', 'REVOLUTION', 'GREAT_REVOLUTION', 'MERCHANT_EXCHANGED']);

export class DalmutiService {
  constructor(io) {
    this.io = io;
    this.queues = new Map();
    this.turnTimers = new Map();
    this.botTimers = new Map();
    this.roundTimers = new Map();
    this.presentationTimers = new Map();
  }

  clearTimers(roomCode) {
    for (const timers of [this.turnTimers, this.botTimers, this.roundTimers]) {
      const timer = timers.get(roomCode);
      if (timer) clearTimeout(timer);
      timers.delete(roomCode);
    }
  }

  runExclusive(roomCode, operation) {
    const previous = this.queues.get(roomCode) || Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    this.queues.set(roomCode, current);
    const cleanup = () => { if (this.queues.get(roomCode) === current) this.queues.delete(roomCode); };
    current.then(cleanup, cleanup);
    return current;
  }

  playerFromRoom(player, hostId) {
    return {
      id: player.id,
      nickname: player.nickname,
      avatarUrl: player.avatarUrl,
      isHost: player.id === hostId,
      isBot: !!player.isBot,
    };
  }

  syncRoom(room, state) {
    room.gameStateObject = state;
    room.gameState = state.matchState;
    room.playPhase = state.playPhase;
    room.stateVersion = state.stateVersion;
    room.roundNumber = state.roundNumber;
    room.turnPlayerId = state.currentTurnPlayerId;
    room.turnExpiresAt = state.turnExpiresAt;
    room.turnTimeLimit = state.config.turnTimeoutSeconds;
    room.maxPlayers = state.config.maxPlayers;
    room.roundCount = state.config.roundCount;
    for (const publicPlayer of state.players) {
      const roomPlayer = room.players.find((candidate) => candidate.id === publicPlayer.id);
      if (!roomPlayer) continue;
      roomPlayer.score = publicPlayer.score;
      roomPlayer.isBot = publicPlayer.isBot;
    }
  }

  async startMatch(roomCode, hostId) {
    return this.runExclusive(roomCode, async () => {
      const room = await roomRepository.getRoom(roomCode);
      if (!room || room.gameType !== 'DALMUTI') throw new Error('달무티 방을 찾을 수 없습니다.');
      if (room.hostId !== hostId) throw new Error('방장만 게임을 시작할 수 있습니다.');
      if (room.players.length < 4 || room.players.length > 8) throw new Error('달무티는 4명부터 8명까지 시작할 수 있습니다.');
      const waiting = room.players.filter((player) => player.id !== hostId && !player.isReady && !player.isBot);
      if (waiting.length) throw new Error('모든 플레이어가 준비 완료해야 합니다.');
      let state = room.gameStateObject;
      if (!state || state.gameType !== 'DALMUTI' || state.matchState === 'GAME_OVER') {
        state = core.createInitialState(
          room.players.map((player) => this.playerFromRoom(player, room.hostId)),
          {
            roundCount: room.roundCount,
            maxPlayers: room.maxPlayers,
            turnTimeoutSeconds: room.turnTimeLimit,
            useStrippedDeck: room.useStrippedDeck,
            philanthropicScoring: room.philanthropicScoring,
            merchantExchange: room.merchantExchange,
          },
          room.seed || Date.now(),
        );
      }
      const { nextState, events } = core.executeCommand(state, { type: 'START_MATCH', playerId: hostId });
      this.syncRoom(room, nextState);
      await roomRepository.saveRoom(room);
      this.emitEvents(roomCode, nextState, events);
      broadcastRoomState(this.io, roomCode);
      this.schedule(roomCode);
      return { success: true };
    });
  }

  async handleCommand(roomCode, command) {
    return this.runExclusive(roomCode, async () => {
      const room = await roomRepository.getRoom(roomCode);
      if (!room?.gameStateObject || room.gameType !== 'DALMUTI') throw new Error('진행 중인 달무티 게임을 찾을 수 없습니다.');
      if (room.isPaused) throw new Error('재접속을 기다리는 동안 게임이 일시정지되었습니다.');
      if (room.dalmutiPresentationGate) throw new Error('이전 행동을 테이블에 표시하는 중입니다.');
      const { nextState, events } = core.executeCommand(room.gameStateObject, command);
      this.syncRoom(room, nextState);
      const envelopes = this.makeEventEnvelopes(nextState, events);
      const eventToGate = [...envelopes].reverse().find((envelope) => PRESENTATION_EVENT_TYPES.has(envelope.event.type));
      if (eventToGate && nextState.matchState === 'PLAYING') {
        room.dalmutiPresentationGate = {
          eventId: eventToGate.eventId,
          waitingFor: room.players.filter((player) => !player.isBot && player.socketId && !player.isDisconnected).map((player) => player.id),
          acknowledged: [],
          fallbackAt: Date.now() + PRESENTATION_FALLBACK_MS,
        };
      }
      await roomRepository.saveRoom(room);
      this.emitEnvelopes(roomCode, envelopes);
      broadcastRoomState(this.io, roomCode);
      this.schedule(roomCode);
      return { success: true, stateVersion: nextState.stateVersion };
    });
  }

  makeEventEnvelopes(state, events) {
    return events.map((event) => ({
        eventId: `${event.id || 'event'}_${state.stateVersion}`,
        stateVersion: state.stateVersion,
        roundNumber: state.roundNumber,
        timestamp: Date.now(),
        event,
      }));
  }

  emitEnvelopes(roomCode, envelopes) {
    for (const envelope of envelopes) this.io.to(roomCode).emit('dalmuti:event', envelope);
  }

  emitEvents(roomCode, state, events) {
    this.emitEnvelopes(roomCode, this.makeEventEnvelopes(state, events));
  }

  schedule(roomCode) {
    this.clearTimers(roomCode);
    void roomRepository.getRoom(roomCode).then((room) => {
      if (!room?.gameStateObject || room.isPaused || room.gameType !== 'DALMUTI') return;
      const state = room.gameStateObject;
      if (room.dalmutiPresentationGate) {
        const eventId = room.dalmutiPresentationGate.eventId;
        const timer = setTimeout(() => {
          this.presentationTimers.delete(roomCode);
          void this.releasePresentation(roomCode, eventId);
        }, Math.max(25, room.dalmutiPresentationGate.fallbackAt - Date.now()));
        timer.unref?.(); this.presentationTimers.set(roomCode, timer); return;
      }
      if (state.matchState === 'ROUND_END') {
        const delay = Math.max(25, Number(state.outcome?.advanceAt || Date.now() + 8000) - Date.now());
        const timer = setTimeout(() => {
          this.roundTimers.delete(roomCode);
          void this.handleCommand(roomCode, { type: 'ADVANCE_ROUND', playerId: room.hostId }).catch(() => {});
        }, delay);
        timer.unref?.(); this.roundTimers.set(roomCode, timer); return;
      }
      if (state.matchState !== 'PLAYING') return;
      const actorId = state.currentTurnPlayerId;
      const actor = room.players.find((player) => player.id === actorId);
      if (actor?.isBot) {
        const version = state.stateVersion;
        const timer = setTimeout(() => {
          this.botTimers.delete(roomCode);
          void this.runBot(roomCode, actorId, version);
        }, BOT_DELAY_MS);
        timer.unref?.(); this.botTimers.set(roomCode, timer); return;
      }
      if (actorId && state.turnExpiresAt > 0) {
        const version = state.stateVersion;
        const timer = setTimeout(() => {
          this.turnTimers.delete(roomCode);
          void this.runTimeout(roomCode, actorId, version);
        }, Math.max(25, state.turnExpiresAt - Date.now()));
        timer.unref?.(); this.turnTimers.set(roomCode, timer);
      }
    });
  }

  async runBot(roomCode, playerId, version) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject || room.isPaused || room.gameStateObject.stateVersion !== version) return;
    const command = core.chooseBotCommand(room.gameStateObject, playerId);
    if (command) await this.handleCommand(roomCode, { ...command, expectedStateVersion: version });
  }

  async runTimeout(roomCode, playerId, version) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject || room.isPaused || room.gameStateObject.stateVersion !== version) return;
    const command = core.chooseTimeoutCommand(room.gameStateObject, playerId);
    if (command) await this.handleCommand(roomCode, { ...command, expectedStateVersion: version });
  }

  async acknowledgePresentation(roomCode, playerId, eventId) {
    return this.runExclusive(roomCode, async () => {
      const room = await roomRepository.getRoom(roomCode);
      const gate = room?.dalmutiPresentationGate;
      if (!gate || gate.eventId !== eventId || !gate.waitingFor.includes(playerId)) return { success: true };
      if (!gate.acknowledged.includes(playerId)) gate.acknowledged.push(playerId);
      if (gate.waitingFor.every((id) => gate.acknowledged.includes(id))) await this.releasePresentationUnlocked(room);
      else await roomRepository.saveRoom(room);
      return { success: true };
    });
  }

  async releasePresentation(roomCode, eventId) {
    return this.runExclusive(roomCode, async () => {
      const room = await roomRepository.getRoom(roomCode);
      if (!room?.dalmutiPresentationGate || room.dalmutiPresentationGate.eventId !== eventId) return;
      await this.releasePresentationUnlocked(room);
    });
  }

  async releasePresentationUnlocked(room) {
    const timer = this.presentationTimers.get(room.code);
    if (timer) clearTimeout(timer);
    this.presentationTimers.delete(room.code);
    room.dalmutiPresentationGate = null;
    await roomRepository.saveRoom(room);
    broadcastRoomState(this.io, room.code);
    this.schedule(room.code);
  }

  async restoreRooms() {
    const rooms = await roomRepository.listRooms();
    for (const room of rooms) {
      if (room.gameType !== 'DALMUTI' || !room.gameStateObject) continue;
      if (room.dalmutiPresentationGate && room.dalmutiPresentationGate.fallbackAt <= Date.now()) {
        room.dalmutiPresentationGate = null;
        await roomRepository.saveRoom(room);
      }
      if (!room.isPaused) this.schedule(room.code);
    }
  }

  projectRoomState(room, requestUserId) {
    const state = room.gameStateObject;
    const publicState = core.getPublicView(state);
    const privateState = core.getPrivateView(state, requestUserId);
    const roomPlayers = new Map(room.players.map((player) => [player.id, player]));
    publicState.players = publicState.players.map((player) => ({
      ...player,
      isDisconnected: !!roomPlayers.get(player.id)?.isDisconnected,
      isHost: player.id === room.hostId,
    }));
    return {
      code: room.code,
      gameType: 'DALMUTI',
      hostId: room.hostId,
      gameState: publicState.matchState,
      playPhase: publicState.playPhase,
      stateVersion: publicState.stateVersion,
      serverTime: Date.now(),
      maxPlayers: publicState.config.maxPlayers,
      turnTimeLimit: publicState.config.turnTimeoutSeconds,
      roundCount: publicState.config.roundCount,
      roundNumber: publicState.roundNumber,
      turnPlayerId: publicState.currentTurnPlayerId,
      turnExpiresAt: publicState.turnExpiresAt,
      isPaused: !!room.isPaused,
      pausedPlayerId: room.pausedPlayerId || null,
      pauseExpiresAt: room.pauseExpiresAt || null,
      presentationPending: !!room.dalmutiPresentationGate,
      chatMessages: (room.chatMessages || []).slice(-30),
      dalmuti: publicState,
      mySecret: privateState,
      players: publicState.players,
    };
  }

  async pauseRoom(roomCode, playerId) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject || room.isPaused) return;
    this.clearTimers(roomCode);
    room.isPaused = true;
    room.pausedPlayerId = playerId;
    room.pauseExpiresAt = Date.now() + 90_000;
    await roomRepository.saveRoom(room);
    broadcastRoomState(this.io, roomCode);
  }

  async resumeRoom(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject) return;
    room.isPaused = false; room.pausedPlayerId = null; room.pauseExpiresAt = null;
    await roomRepository.saveRoom(room);
    broadcastRoomState(this.io, roomCode);
    this.schedule(roomCode);
  }

  async disconnectExpired(roomCode, playerId) {
    const room = await roomRepository.getRoom(roomCode);
    const player = room?.players.find((candidate) => candidate.id === playerId);
    const gamePlayer = room?.gameStateObject?.players.find((candidate) => candidate.id === playerId);
    if (!room || !player || !gamePlayer) return;
    player.isBot = true; player.takenOverByBot = true; player.isDisconnected = false; player.socketId = null;
    core.assignBotProfile(room.gameStateObject, playerId);
    room.isPaused = false; room.pausedPlayerId = null; room.pauseExpiresAt = null;
    if (room.hostId === playerId) {
      const nextHost = room.players.find((candidate) => !candidate.isBot && candidate.socketId);
      if (nextHost) room.hostId = nextHost.id;
    }
    await roomRepository.saveRoom(room);
    broadcastRoomState(this.io, roomCode);
    this.schedule(roomCode);
  }
}

export function createDalmutiService(io) { return new DalmutiService(io); }
