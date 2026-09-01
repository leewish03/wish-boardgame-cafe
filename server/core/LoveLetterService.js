import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { roomRepository } from './RoomRepository.js';
import { TurnCoordinator } from './TurnCoordinator.js';
import { decideBotAction } from './AiBotController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadTs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const transformed = esbuild.transformSync(content, {
    loader: 'ts',
    target: 'node18',
    format: 'cjs',
  });
  const m = { exports: {} };
  const dirname = path.dirname(filePath);
  const customRequire = (reqPath) => {
    let resolved = path.resolve(dirname, reqPath);
    if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
      if (fs.existsSync(resolved + '.ts')) resolved += '.ts';
      else if (fs.existsSync(resolved + '.js')) resolved += '.js';
    }
    if (resolved.endsWith('.ts')) {
      return loadTs(resolved);
    }
    return require(resolved);
  };
  const fn = new Function('module', 'exports', 'require', '__dirname', '__filename', transformed.code);
  fn(m, m.exports, customRequire, dirname, filePath);
  return m.exports;
}

const root = path.resolve(__dirname, '../../');
const core = loadTs(path.join(root, 'packages/love-letter-core/src/index.ts'));
const { SOCKET_EVENTS } = loadTs(path.join(root, 'packages/protocol/src/index.ts'));
// Leave time for the client-side causal sequence (card → target → result → discard)
// before an automated opponent creates the next authoritative action.
// The client has its own short causal presentation. Keeping a second 3.5s
// server delay made multiplayer turns feel stalled after the snapshot settled.
// A bot may act only after the longest normal client causal sequence has had
// time to settle. This keeps two adjacent bot turns legible without returning
// to the old multi-second artificial stall.
const BOT_PRESENTATION_GAP_MS = 2000;
export { SOCKET_EVENTS };

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

/** Build a legal, deliberately random play for a timed-out human turn. */
function createTimeoutPlayCommand(gameState, playerId) {
  const hand = gameState.secrets?.[playerId]?.hand || [];
  if (!hand.length) return null;

  // The Countess rule is mandatory even when the card itself is selected at random.
  const hasCountess = hand.some((card) => card.value === 7);
  const hasPrinceOrKing = hand.some((card) => card.value === 5 || card.value === 6);
  const candidates = hasCountess && hasPrinceOrKing ? hand.filter((card) => card.value === 7) : hand;
  const card = randomItem(candidates);
  const opponents = gameState.players.filter((player) => player.id !== playerId && !player.isEliminated && !player.isProtected);
  const command = { type: 'PLAY_CARD', playerId, cardId: card.id };

  if ([1, 2, 3, 6].includes(card.value) && opponents.length) {
    command.targetId = randomItem(opponents).id;
  } else if (card.value === 5) {
    const princeTargets = gameState.players.filter((player) => !player.isEliminated && (!player.isProtected || player.id === playerId));
    command.targetId = randomItem(princeTargets).id;
  }
  if (card.value === 1 && command.targetId) command.guessValue = randomItem([2, 3, 4, 5, 6, 7, 8]);
  return command;
}

export class LoveLetterService {
  constructor(io, { broadcastRoomState } = {}) {
    this.io = io;
    this.broadcastRoomState = broadcastRoomState || (() => {});
    this.turnCoordinator = new TurnCoordinator(io, this);
    this.eventCounters = new Map();
    this.commandQueues = new Map();
    this.botTimers = new Map();
    this.pauseExpiryTimers = new Map();
    this.roundAdvanceTimers = new Map();
    this.progressRequests = new Map();
  }

  getNextEventId(roomCode) {
    const count = (this.eventCounters.get(roomCode) || 0) + 1;
    this.eventCounters.set(roomCode, count);
    return `evt_${Date.now()}_${count}`;
  }

  getActionId(gameState, event) {
    // A replacement/next-turn draw is the final physical beat of the command
    // that caused it. Initial dealing has no last action and stays separate.
    if (event.type === 'CARD_DRAWN') return event.actionId || gameState.lastAction?.actionId || `draw_${gameState.stateVersion}_${event.playerId}_${event.remainingDeckCount}`;
    return event.actionId || gameState.lastAction?.actionId || `transition_${gameState.stateVersion}`;
  }

  projectEventForPlayer(event, gameState, recipientPlayerId) {
    const projected = { ...event };
    if (projected.type === 'CARD_DRAWN' && projected.playerId !== recipientPlayerId) {
      delete projected.card;
    }
    if (
      (projected.type === 'PRIEST_USED' || projected.type === 'PRIEST_REVEALED') &&
      projected.actorId !== recipientPlayerId
    ) {
      delete projected.revealedCard;
    }
    return projected;
  }

  broadcastGameEvent(roomCode, gameState, event) {
    const actionId = this.getActionId(gameState, event);
    for (const player of gameState.players) {
      const sessionPlayer = roomRepository._rooms.get(roomCode)?.players.find((candidate) => candidate.id === player.id);
      if (!sessionPlayer?.socketId) continue;
      const envelope = {
        eventId: this.getNextEventId(roomCode),
        actionId,
        stateVersion: gameState.stateVersion,
        timestamp: Date.now(),
        recipientPlayerId: player.id,
        event: this.projectEventForPlayer(event, gameState, player.id),
        presentation: gameState.lastAction && gameState.lastAction.actionId === actionId
          ? this.projectPresentationForPlayer(gameState.lastAction, player.id)
          : null,
      };
      this.io.to(sessionPlayer.socketId).emit(SOCKET_EVENTS.GAME_EVENT, envelope);
    }
  }

  projectPresentationForPlayer(summary, recipientPlayerId) {
    if (summary.resultType !== 'PRIEST_REVEAL' || summary.actorId === recipientPlayerId) {
      return summary;
    }
    const { revealedCard, ...publicSummary } = summary;
    return publicSummary;
  }

  applyGameStateToRoom(room, gameState) {
    room.gameStateObject = gameState;
    room.gameState = gameState.matchState;
    room.playPhase = gameState.playPhase;
    room.stateVersion = gameState.stateVersion;
    room.roundNumber = gameState.roundNumber;
    room.turnPlayerId = gameState.currentTurnPlayerId;
    room.turnExpiresAt = gameState.turnExpiresAt;
    room.targetTokens = gameState.config.targetTokens;
    room.turnTimeLimit = gameState.config.turnTimeoutSeconds;

    for (const gamePlayer of gameState.players) {
      const roomPlayer = room.players.find((player) => player.id === gamePlayer.id);
      if (!roomPlayer) continue;
      roomPlayer.tokens = gamePlayer.tokens;
      roomPlayer.isEliminated = gamePlayer.isEliminated;
      roomPlayer.isProtected = gamePlayer.isProtected;
      roomPlayer.discardPile = gamePlayer.discardPile;
    }
  }

  broadcastGameSnapshot(roomCode, room) {
    if (!room || !room.gameStateObject) return;
    const gs = room.gameStateObject;

    const publicState = core.getPublicGameState(gs);
    // A no-contest match removes bot/departed sessions immediately. Project
    // the same roster into the authoritative snapshot so the board cannot
    // retain ghost seats while room:state catches up.
    if (gs.outcome?.reason === 'INSUFFICIENT_HUMANS') {
      const activeIds = new Set(room.players.map((player) => player.id));
      publicState.players = publicState.players.filter((player) => activeIds.has(player.id));
      publicState.roundWinnerIds = [];
      publicState.matchWinnerId = null;
      publicState.outcome = { ...publicState.outcome, winnerIds: [], matchWinnerId: null };
    }
    for (const player of room.players) {
      if (player.socketId) {
        const secret = core.getPrivatePlayerState(gs, player.id);
        const snapshot = {
          roomId: roomCode,
          stateVersion: gs.stateVersion,
          serverTime: Date.now(),
          publicState,
          privateState: secret,
        };
        this.io.to(player.socketId).emit(SOCKET_EVENTS.GAME_SNAPSHOT, snapshot);
      }
    }
  }

  async handleCommand(roomCode, command) {
    // Socket.IO can deliver two clicks or a timeout and a click in the same
    // tick. Serialize authoritative mutations per room so a stale command
    // cannot apply against the same snapshot twice.
    const previous = this.commandQueues.get(roomCode) || Promise.resolve();
    const operation = previous.catch(() => {}).then(() => this.applyCommand(roomCode, command));
    this.commandQueues.set(roomCode, operation);
    operation.finally(() => {
      if (this.commandQueues.get(roomCode) === operation) this.commandQueues.delete(roomCode);
    }).catch(() => {});
    return operation;
  }

  async applyCommand(roomCode, command) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room || !room.gameStateObject) {
      throw new Error('방을 찾을 수 없습니다.');
    }
    if (room.isPaused && command.type !== 'FORFEIT') {
      throw new Error('재접속을 기다리는 동안 게임이 일시 정지되었습니다.');
    }
    if (command.type === 'FORFEIT') {
      this.clearPauseExpiryTimer(roomCode);
    }

    const { nextState, events } = core.executeCommand(room.gameStateObject, command);
    this.applyGameStateToRoom(room, nextState);
    if (nextState.outcome?.reason === 'INSUFFICIENT_HUMANS') {
      this.clearBotTimer(roomCode);
      this.turnCoordinator.clearTurnTimer(roomCode);
      this.clearRoundAdvanceTimer(roomCode);
      // Bots are not valid remaining participants after a human leaves. Keep
      // the authoritative game snapshot intact for the result sheet, but take
      // their sessions out of the room immediately so no bot turn can resume.
      room.players = room.players.filter((player) => !player.isBot);
    }
    this.scheduleRoundAdvance(roomCode, room, nextState);
    await roomRepository.saveRoom(room);

    for (const [sequence, ev] of events.entries()) {
      this.broadcastGameEvent(roomCode, nextState, { ...ev, sequence: ev.sequence ?? sequence });
    }

    this.broadcastGameSnapshot(roomCode, room);
    this.broadcastRoomState(this.io, roomCode);
    this.scheduleTurnTimeout(roomCode, nextState);
    this.scheduleNextTurnIfBot(roomCode);

    return { nextState, events };
  }

  async startMatch(roomCode, hostId) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('방을 찾을 수 없습니다.');
    if (room.hostId !== hostId) throw new Error('방장만 게임을 시작할 수 있습니다.');
    if (room.players.length < 2) throw new Error('최소 2명 이상의 플레이어가 필요합니다.');
    if (room.gameState === 'LOBBY') {
      const waiting = room.players.filter((player) => player.id !== hostId && !player.isReady && !player.isBot);
      if (waiting.length > 0) throw new Error('모든 플레이어가 준비 완료해야 합니다.');
    }

    const players = room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      avatar: player.avatarUrl || player.avatar || '👑',
      isHost: player.id === room.hostId,
      isBot: !!player.isBot,
      tokens: room.gameState === 'GAME_OVER' ? 0 : player.tokens || 0,
      personality: player.personality,
      memory: player.memory,
    }));
    const storedState = room.gameStateObject;
    // A player who forfeited remains in the completed round snapshot, but not
    // in the next deal. Preserve all remaining players' score state.
    const baseState = storedState && room.gameState === 'ROUND_END'
      ? {
          ...storedState,
          players: storedState.players.filter((player) => players.some((active) => active.id === player.id)),
          secrets: Object.fromEntries(Object.entries(storedState.secrets || {}).filter(([id]) => players.some((active) => active.id === id))),
        }
      : storedState || core.createInitialGameState(players, {
      targetTokens: room.targetTokens,
      turnTimeoutSeconds: room.turnTimeLimit,
      maxPlayers: room.maxPlayers,
    });
    const command = room.gameState === 'ROUND_END'
      ? { type: 'START_ROUND' }
      : { type: 'START_MATCH', config: {
        targetTokens: room.targetTokens,
        turnTimeoutSeconds: room.turnTimeLimit,
        maxPlayers: room.maxPlayers,
      } };
    const { nextState, events } = core.executeCommand(baseState, command);
    this.clearRoundAdvanceTimer(roomCode);
    this.applyGameStateToRoom(room, nextState);
    await roomRepository.saveRoom(room);
    for (const [sequence, event] of events.entries()) this.broadcastGameEvent(roomCode, nextState, { ...event, sequence: event.sequence ?? sequence });
    this.broadcastGameSnapshot(roomCode, room);
    this.broadcastRoomState(this.io, roomCode);
    this.scheduleTurnTimeout(roomCode, nextState);
    this.scheduleNextTurnIfBot(roomCode);
    return { nextState, events };
  }

  clearRoundAdvanceTimer(roomCode) {
    const timer = this.roundAdvanceTimers.get(roomCode);
    if (timer) clearTimeout(timer);
    this.roundAdvanceTimers.delete(roomCode);
  }

  scheduleRoundAdvance(roomCode, room, gameState) {
    this.clearRoundAdvanceTimer(roomCode);
    if (gameState.matchState !== 'ROUND_END') return;
    const advanceAt = Date.now() + 10_000;
    if (gameState.outcome) {
      gameState.outcome.advanceAt = advanceAt;
      gameState.outcome.canAdvanceAt = advanceAt - 7_000;
    }
    room.gameStateObject = gameState;
    const timer = setTimeout(async () => {
      this.roundAdvanceTimers.delete(roomCode);
      const latest = await roomRepository.getRoom(roomCode);
      if (!latest?.gameStateObject || latest.gameStateObject.matchState !== 'ROUND_END') return;
      try { await this.startMatch(roomCode, latest.hostId); } catch (error) { console.error('Automatic round advance failed:', error.message); }
    }, 10_000);
    timer.unref?.();
    this.roundAdvanceTimers.set(roomCode, timer);
  }

  async runProgressRequest(roomCode, hostId, requestId, operation) {
    if (!requestId || typeof requestId !== 'string') throw new Error('진행 요청 식별자가 필요합니다.');
    const key = `${roomCode}:${hostId}:${requestId}`;
    const existing = this.progressRequests.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(operation).then((result) => ({
      accepted: true,
      resultingStateVersion: result?.nextState?.stateVersion ?? null,
    }));
    this.progressRequests.set(key, request);
    const clearRequest = () => {
      const expiry = setTimeout(() => this.progressRequests.delete(key), 60_000);
      expiry.unref?.();
    };
    request.then(clearRequest, clearRequest);
    return request;
  }

  async advanceRound(roomCode, hostId, expectedStateVersion, requestId) {
    return this.runProgressRequest(roomCode, hostId, requestId, async () => {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject) throw new Error('방을 찾을 수 없습니다.');
    if (room.hostId !== hostId) throw new Error('방장만 다음 라운드를 시작할 수 있습니다.');
    if (room.gameStateObject.matchState !== 'ROUND_END') throw new Error('다음 라운드를 시작할 수 있는 상태가 아닙니다.');
    if (expectedStateVersion != null && expectedStateVersion !== room.gameStateObject.stateVersion) throw new Error('게임 상태가 변경되었습니다. 다시 확인해 주세요.');
    const manualAdvanceAt = Number(room.gameStateObject.outcome?.advanceAt || 0) - 7_000;
    if (manualAdvanceAt > Date.now()) throw new Error('결과를 확인할 시간을 잠시 더 주세요.');
    return this.startMatch(roomCode, hostId);
    });
  }

  async startRematch(roomCode, hostId, expectedStateVersion, requestId) {
    return this.runProgressRequest(roomCode, hostId, requestId, async () => {
      const room = await roomRepository.getRoom(roomCode);
      if (!room?.gameStateObject) throw new Error('방을 찾을 수 없습니다.');
      if (room.hostId !== hostId) throw new Error('방장만 새 매치를 시작할 수 있습니다.');
      if (room.gameStateObject.matchState !== 'GAME_OVER') throw new Error('새 매치를 시작할 수 있는 상태가 아닙니다.');
      if (expectedStateVersion != null && expectedStateVersion !== room.gameStateObject.stateVersion) throw new Error('게임 상태가 변경되었습니다. 다시 확인해 주세요.');
      return this.startMatch(roomCode, hostId);
    });
  }

  scheduleTurnTimeout(roomCode, gameState) {
    if (gameState.matchState !== 'PLAYING' || gameState.playPhase !== 'TURN_INPUT' || !gameState.currentTurnPlayerId) {
      this.turnCoordinator.clearTurnTimer(roomCode);
      return;
    }
    if (gameState.config.turnTimeoutSeconds <= 0) return;
    const playerId = gameState.currentTurnPlayerId;
    const stateVersion = gameState.stateVersion;
    const turnExpiresAt = gameState.turnExpiresAt;
    this.turnCoordinator.startTurnTimer(roomCode, gameState.turnExpiresAt, () => {
      roomRepository.getRoom(roomCode).then((room) => {
        if (room?.isPaused) return;
        const latestState = room?.gameStateObject;
        if (
          !latestState ||
          latestState.currentTurnPlayerId !== playerId ||
          latestState.stateVersion !== stateVersion ||
          latestState.turnExpiresAt !== turnExpiresAt ||
          latestState.matchState !== 'PLAYING'
        ) return;
        const timeoutPlay = createTimeoutPlayCommand(latestState, playerId);
        if (!timeoutPlay) return;
        return this.handleCommand(roomCode, timeoutPlay);
      }).catch((error) => {
        console.error('Timed-out random play failed:', error.message);
      });
    });
  }

  clearBotTimer(roomCode) {
    const timer = this.botTimers.get(roomCode);
    if (timer) clearTimeout(timer);
    this.botTimers.delete(roomCode);
  }

  clearPauseExpiryTimer(roomCode) {
    const timer = this.pauseExpiryTimers.get(roomCode);
    if (timer) clearTimeout(timer);
    this.pauseExpiryTimers.delete(roomCode);
  }

  appendSystemMessage(room, text) {
    if (!room.chatMessages) room.chatMessages = [];
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'system',
      text,
      timestamp: Date.now(),
    };
    room.chatMessages.push(message);
    if (room.chatMessages.length > 100) room.chatMessages.splice(0, room.chatMessages.length - 100);
    return message;
  }

  async expirePausedPlayer(roomCode, playerId, expectedExpiry) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.isPaused || room.pausedPlayerId !== playerId || room.pauseExpiresAt !== expectedExpiry) return;
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player?.isDisconnected) return;

    room.isPaused = false;
    room.pausedPlayerId = null;
    room.pauseExpiresAt = null;
    delete room.pausedTurnRemainingMs;
    await this.handleCommand(roomCode, { type: 'FORFEIT', playerId });

    // The disconnected member is no longer eligible to rejoin a finished
    // table. Bots have already been removed by handleCommand if humans fell
    // below two.
    room.players = room.players.filter((candidate) => candidate.id !== playerId);
    if (room.hostId === playerId && room.players.length) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
      room.players[0].isReady = true;
    }
    const message = this.appendSystemMessage(room, `${player.nickname}님이 재접속하지 않아 퇴장했습니다.`);
    this.io.to(roomCode).emit('chat:message', message);
    await roomRepository.saveRoom(room);
    this.broadcastRoomState(this.io, roomCode);
  }

  async pauseRoom(roomCode, playerId) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject || room.isPaused) return;

    room.isPaused = true;
    room.pausedPlayerId = playerId;
    room.pauseExpiresAt = Date.now() + 180_000;
    room.pausedTurnRemainingMs = Math.max(0, room.gameStateObject.turnExpiresAt - Date.now());
    this.turnCoordinator.clearTurnTimer(roomCode);
    this.clearBotTimer(roomCode);
    this.clearPauseExpiryTimer(roomCode);
    const pauseExpiry = room.pauseExpiresAt;
    const timer = setTimeout(() => {
      this.pauseExpiryTimers.delete(roomCode);
      this.expirePausedPlayer(roomCode, playerId, pauseExpiry).catch((error) => {
        console.error('Paused player expiry failed:', error.message);
      });
    }, Math.max(1_000, pauseExpiry - Date.now()));
    timer.unref?.();
    this.pauseExpiryTimers.set(roomCode, timer);
    await roomRepository.saveRoom(room);
    this.broadcastRoomState(this.io, roomCode);
  }

  async resumeRoom(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject || !room.isPaused) return;

    const now = Date.now();
    this.clearPauseExpiryTimer(roomCode);
    const remaining = Math.max(1_000, Number(room.pausedTurnRemainingMs) || room.gameStateObject.config.turnTimeoutSeconds * 1_000);
    const nextState = {
      ...room.gameStateObject,
      turnStartedAt: now,
      turnExpiresAt: now + remaining,
      stateVersion: room.gameStateObject.stateVersion + 1,
    };
    room.isPaused = false;
    room.pausedPlayerId = null;
    room.pauseExpiresAt = null;
    delete room.pausedTurnRemainingMs;
    this.applyGameStateToRoom(room, nextState);
    await roomRepository.saveRoom(room);
    this.broadcastGameSnapshot(roomCode, room);
    this.broadcastRoomState(this.io, roomCode);
    this.scheduleTurnTimeout(roomCode, nextState);
    this.scheduleNextTurnIfBot(roomCode);
  }

  async scheduleNextTurnIfBot(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room || !room.gameStateObject || room.isPaused || room.gameStateObject.matchState !== 'PLAYING') return;

    const gs = room.gameStateObject;
    const currentTurnPlayer = gs.players.find(p => p.id === gs.currentTurnPlayerId);
    const expectedStateVersion = gs.stateVersion;
    const expectedTurnExpiresAt = gs.turnExpiresAt;

    if (currentTurnPlayer && currentTurnPlayer.isBot && !currentTurnPlayer.isEliminated) {
      this.clearBotTimer(roomCode);
      const botTimer = setTimeout(async () => {
        this.botTimers.delete(roomCode);
        const latestRoom = await roomRepository.getRoom(roomCode);
        if (!latestRoom || !latestRoom.gameStateObject || latestRoom.isPaused) return;
        const latestGs = latestRoom.gameStateObject;
        if (
          latestGs.currentTurnPlayerId !== currentTurnPlayer.id ||
          latestGs.stateVersion !== expectedStateVersion ||
          latestGs.turnExpiresAt !== expectedTurnExpiresAt ||
          latestGs.matchState !== 'PLAYING'
        ) return;

        const botAction = decideBotAction(latestGs, currentTurnPlayer);
        if (botAction) {
          try {
            await this.handleCommand(roomCode, {
              type: 'PLAY_CARD',
              playerId: currentTurnPlayer.id,
              cardId: botAction.cardId,
              targetId: botAction.targetId,
              guessValue: botAction.guessValue,
            });
          } catch (e) {
            console.error('Bot action error:', e.message);
          }
        }
      }, BOT_PRESENTATION_GAP_MS);
      botTimer.unref?.();
      this.botTimers.set(roomCode, botTimer);
    }
  }
}

export const createLoveLetterService = (io, options) => new LoveLetterService(io, options);
