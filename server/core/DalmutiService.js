import { roomRepository } from './RoomRepository.js';
import { broadcastRoomState, rooms } from '../shared/roomManager.js';
import * as core from '../../packages/dalmuti-core/src/index.js';

const PRESENTATION_FALLBACK_MS = 900;
const PRESENTATION_EVENT_TYPES = new Set(['ROUND_DEALT', 'OPENING_READY', 'PLAY_STARTED', 'SET_PLAYED', 'PASSED', 'TRICK_CLEARED', 'TAX_COMPLETED', 'REVOLUTION', 'GREAT_REVOLUTION', 'MERCHANT_EXCHANGED', 'ROUND_ENDED', 'MATCH_ENDED']);

export class DalmutiService {
  constructor(io) {
    this.io = io;
    this.queues = new Map();
    this.turnTimers = new Map();
    this.botTimers = new Map();
    this.roundTimers = new Map();
    this.presentationTimers = new Map();
    this.pauseTimers = new Map();
  }

  clearTimers(roomCode) {
    for (const timers of [this.turnTimers, this.botTimers, this.roundTimers, this.presentationTimers]) {
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
      personality: player.personality || player.botPersonality,
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
      const envelopes = this.makeEventEnvelopes(nextState, events);
      this.preparePresentation(room, envelopes);
      await roomRepository.saveRoom(room);
      this.emitEnvelopes(roomCode, envelopes);
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
      const actor = room.players.find((player) => player.id === command.playerId);
      const actorKind = actor?.isBot ? 'BOT' : 'HUMAN';
      const analysis = core.analyzeBotDecision(room.gameStateObject, command.playerId, actorKind === 'HUMAN' ? 'STRATEGIC' : null);
      const trace = core.createDecisionTrace(room.gameStateObject, command, actorKind, analysis);
      if (actorKind === 'BOT') trace.botProfile = room.gameStateObject.players.find((player) => player.id === command.playerId)?.botProfile || null;
      const { nextState, events } = core.executeCommand(room.gameStateObject, command);
      this.syncRoom(room, nextState);
      const envelopes = this.makeEventEnvelopes(nextState, events);
      this.preparePresentation(room, envelopes);
      await roomRepository.saveRoom(room);
      void roomRepository.recordDalmutiDecision?.(trace).catch(() => {});
      if (nextState.lastAction?.type === 'ROUND_ENDED' || nextState.lastAction?.type === 'MATCH_ENDED') {
        core.createRoundResultTraces(nextState).forEach((result) => {
          void roomRepository.recordDalmutiDecision?.(result).catch(() => {});
        });
      }
      this.emitEnvelopes(roomCode, envelopes);
      broadcastRoomState(this.io, roomCode);
      this.schedule(roomCode);
      return { success: true, stateVersion: nextState.stateVersion };
    });
  }

  makeEventEnvelopes(state, events) {
    return events.map((event, eventIndex) => ({
        eventId: `${event.id || 'event'}_${state.stateVersion}`,
        stateVersion: state.stateVersion,
        roundNumber: state.roundNumber,
        eventIndex,
        eventCount: events.length,
        timestamp: Date.now(),
        event,
      }));
  }

  preparePresentation(room, envelopes) {
    if (!envelopes.some(({ event }) => PRESENTATION_EVENT_TYPES.has(event.type))) return;
    const waitingFor = room.players.filter((player) => !player.isBot && player.socketId && !player.isDisconnected).map((player) => player.id);
    if (!waitingFor.length) return;
    const last = envelopes.at(-1);
    room.dalmutiPresentationGate = {
      eventId: last.eventId, stateVersion: last.stateVersion,
      waitingFor, acknowledged: [],
      fallbackAt: Date.now() + Math.min(2700, envelopes.length * PRESENTATION_FALLBACK_MS),
    };
    // The next turn/result clock starts only when this batch settles.
    room.gameStateObject.turnExpiresAt = 0;
    if (room.gameStateObject.outcome?.advanceAt) room.gameStateObject.outcome.advanceAt = null;
    this.syncRoom(room, room.gameStateObject);
  }

  emitEnvelopes(roomCode, envelopes) {
    for (const envelope of envelopes) this.io.to(roomCode).emit('dalmuti:event', envelope);
  }

  emitEvents(roomCode, state, events) {
    this.emitEnvelopes(roomCode, this.makeEventEnvelopes(state, events));
  }

  schedule(roomCode) {
    this.clearTimers(roomCode);
    // The shared room proxy reads the repository cache synchronously; no
    // delayed lookup can install a timer after a later pause/delete cleared it.
    const room = rooms[roomCode];
      if (!room?.gameStateObject || room.isPaused || room.gameType !== 'DALMUTI') return;
      const state = room.gameStateObject;
      if (room.dalmutiPresentationGate) {
        const eventId = room.dalmutiPresentationGate.eventId;
        const timer = setTimeout(() => {
          this.presentationTimers.delete(roomCode);
          void this.releasePresentation(roomCode, eventId).catch((error) => console.error('Dalmuti presentation recovery:', error));
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
        const delay = core.getBotThinkDelay(state, actorId);
        const timer = setTimeout(() => {
          this.botTimers.delete(roomCode);
          void this.runBot(roomCode, actorId, version).catch((error) => console.error('Dalmuti bot turn:', error));
        }, delay);
        timer.unref?.(); this.botTimers.set(roomCode, timer); return;
      }
      if (actorId && state.turnExpiresAt > 0) {
        const version = state.stateVersion;
        const timer = setTimeout(() => {
          this.turnTimers.delete(roomCode);
          void this.runTimeout(roomCode, actorId, version).catch((error) => console.error('Dalmuti turn timeout:', error));
        }, Math.max(25, state.turnExpiresAt - Date.now()));
        timer.unref?.(); this.turnTimers.set(roomCode, timer);
      }
  }

  async runBot(roomCode, playerId, version) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject || room.isPaused || room.dalmutiPresentationGate || room.gameStateObject.stateVersion !== version || room.gameStateObject.currentTurnPlayerId !== playerId || !room.players.find((player) => player.id === playerId)?.isBot) return;
    const command = core.chooseBotCommand(room.gameStateObject, playerId);
    if (command) await this.handleCommand(roomCode, { ...command, expectedStateVersion: version });
  }

  async runTimeout(roomCode, playerId, version) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject || room.isPaused || room.dalmutiPresentationGate || room.gameStateObject.stateVersion !== version || room.gameStateObject.currentTurnPlayerId !== playerId || !room.gameStateObject.turnExpiresAt || room.gameStateObject.turnExpiresAt > Date.now()) return;
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
    this.startClocks(room);
    await roomRepository.saveRoom(room);
    broadcastRoomState(this.io, room.code);
    this.schedule(room.code);
  }

  async restoreRooms() {
    const rooms = await roomRepository.listRooms();
    for (const room of rooms) {
      if (room.gameType !== 'DALMUTI' || !room.gameStateObject) continue;
      if (room.dalmutiPresentationGate) {
        room.dalmutiPresentationGate = null;
        room.pausedTurnRemainingMs ??= room.gameStateObject.config.turnTimeoutSeconds * 1000;
        room.pausedRoundRemainingMs ??= 8000;
      }
      if (room.isPaused) {
        room.pauseExpiresAt ??= Date.now() + 90_000;
        room.pausedTurnRemainingMs ??= room.gameStateObject.config.turnTimeoutSeconds * 1000;
        room.pausedRoundRemainingMs ??= 8000;
        await roomRepository.saveRoom(room);
        this.schedulePause(room);
      } else {
        await roomRepository.saveRoom(room);
        this.schedule(room.code);
      }
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
      presentationBatch: room.dalmutiPresentationGate ? {
        stateVersion: room.dalmutiPresentationGate.stateVersion,
        eventId: room.dalmutiPresentationGate.eventId,
        fallbackAt: room.dalmutiPresentationGate.fallbackAt,
      } : null,
      chatMessages: (room.chatMessages || []).slice(-30),
      dalmuti: publicState,
      mySecret: privateState,
      players: publicState.players,
    };
  }

  async pauseRoom(roomCode, playerId) {
    return this.runExclusive(roomCode, async () => {
      const room = await roomRepository.getRoom(roomCode);
      if (!room?.gameStateObject) return;
      if (!room.isPaused) {
        const state = room.gameStateObject;
        room.pausedTurnRemainingMs = room.dalmutiPresentationGate ? state.config.turnTimeoutSeconds * 1000 : Math.max(0, state.turnExpiresAt - Date.now());
        room.pausedRoundRemainingMs = room.dalmutiPresentationGate ? 8000 : Math.max(0, (state.outcome?.advanceAt || Date.now() + 8000) - Date.now());
        room.isPaused = true;
        room.pausedPlayerId = playerId;
        room.pauseExpiresAt = Date.now() + 90_000;
      }
      this.clearTimers(roomCode);
      room.dalmutiPresentationGate = null;
      await roomRepository.saveRoom(room);
      this.schedulePause(room);
      broadcastRoomState(this.io, roomCode);
    });
  }

  async resumeRoom(roomCode) {
    return this.runExclusive(roomCode, async () => {
      const room = await roomRepository.getRoom(roomCode);
      if (!room?.gameStateObject) return;
      if (room.players.some((player) => !player.isBot && player.isDisconnected)) {
        this.schedulePause(room);
        return;
      }
      await this.resumeUnlocked(room);
    });
  }

  clearPauseTimer(roomCode) {
    clearTimeout(this.pauseTimers.get(roomCode));
    this.pauseTimers.delete(roomCode);
  }

  schedulePause(room) {
    this.clearPauseTimer(room.code);
    if (!room.isPaused) return;
    const deadline = room.pauseExpiresAt;
    const timer = setTimeout(() => {
      void this.disconnectExpired(room.code).catch((error) => console.error('Dalmuti reconnect expiry:', error));
    }, Math.max(0, deadline - Date.now()));
    timer.unref?.();
    this.pauseTimers.set(room.code, timer);
  }

  startClocks(room, remaining = false) {
    const state = room.gameStateObject;
    if (state.matchState === 'PLAYING') {
      state.turnStartedAt = Date.now();
      state.turnExpiresAt = state.config.turnTimeoutSeconds > 0 ? Date.now() + (remaining ? room.pausedTurnRemainingMs ?? state.config.turnTimeoutSeconds * 1000 : state.config.turnTimeoutSeconds * 1000) : 0;
    }
    if (state.matchState === 'ROUND_END') state.outcome.advanceAt = Date.now() + (remaining ? room.pausedRoundRemainingMs ?? 8000 : 8000);
    this.syncRoom(room, state);
  }

  async resumeUnlocked(room) {
    this.clearPauseTimer(room.code);
    if (room.isPaused) this.startClocks(room, true);
    room.isPaused = false; room.pausedPlayerId = null; room.pauseExpiresAt = null;
    delete room.pausedTurnRemainingMs; delete room.pausedRoundRemainingMs;
    await roomRepository.saveRoom(room);
    broadcastRoomState(this.io, room.code);
    this.schedule(room.code);
  }

  takeOver(room, player) {
    player.isBot = true; player.takenOverByBot = true; player.isDisconnected = false; player.socketId = null;
    core.assignBotProfile(room.gameStateObject, player.id);
    if (room.hostId === player.id) {
      const nextHost = room.players.find((candidate) => !candidate.isBot && candidate.socketId);
      if (nextHost) room.hostId = nextHost.id;
    }
    const gate = room.dalmutiPresentationGate;
    if (gate) gate.waitingFor = gate.waitingFor.filter((id) => id !== player.id);
    room.gameStateObject.stateVersion += 1;
    this.syncRoom(room, room.gameStateObject);
  }

  async deleteRoom(room) {
    this.clearTimers(room.code); this.clearPauseTimer(room.code);
    await roomRepository.deleteRoom(room.code);
    this.io.to(room.code).emit('room:unavailable', { error: '모든 플레이어가 퇴장해 게임이 종료되었습니다.' });
  }

  async deleteIfNoHumans(room) {
    if (room.players.some((player) => !player.isBot)) return false;
    await this.deleteRoom(room);
    return true;
  }

  async disconnectExpired(roomCode) {
    return this.runExclusive(roomCode, async () => {
      const room = await roomRepository.getRoom(roomCode);
      if (!room?.isPaused || room.pauseExpiresAt > Date.now()) return;
      room.players.filter((player) => !player.isBot && player.isDisconnected).forEach((player) => this.takeOver(room, player));
      if (await this.deleteIfNoHumans(room)) return;
      await this.resumeUnlocked(room);
    });
  }

  async finalizeDeparture(roomCode, playerId) {
    return this.runExclusive(roomCode, async () => {
      const room = await roomRepository.getRoom(roomCode);
      if (!room?.gameStateObject) return { retainSeat: false };
      const player = room.players.find((candidate) => candidate.id === playerId);
      if (!player || player.isBot) return { retainSeat: true };
      if (room.gameStateObject.matchState === 'GAME_OVER') {
        if (!room.players.some((candidate) => candidate.id !== playerId && !candidate.isBot)) {
          await this.deleteRoom(room);
          return { retainSeat: false, roomDeleted: true };
        }
        const gate = room.dalmutiPresentationGate;
        if (gate) {
          gate.waitingFor = gate.waitingFor.filter((id) => id !== playerId);
          if (gate.waitingFor.every((id) => gate.acknowledged.includes(id))) await this.releasePresentationUnlocked(room);
        }
        return { retainSeat: false };
      }
      this.takeOver(room, player);
      if (await this.deleteIfNoHumans(room)) return { retainSeat: true, roomDeleted: true };
      if (room.isPaused && room.players.some((candidate) => !candidate.isBot && candidate.isDisconnected)) {
        await roomRepository.saveRoom(room);
        this.schedulePause(room); broadcastRoomState(this.io, roomCode);
      } else if (room.dalmutiPresentationGate && room.dalmutiPresentationGate.waitingFor.every((id) => room.dalmutiPresentationGate.acknowledged.includes(id))) {
        await this.releasePresentationUnlocked(room);
      } else await this.resumeUnlocked(room);
      return { retainSeat: true };
    });
  }
}

export function createDalmutiService(io) { return new DalmutiService(io); }
