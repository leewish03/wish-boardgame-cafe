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
export { SOCKET_EVENTS };

export class LoveLetterService {
  constructor(io, { broadcastRoomState } = {}) {
    this.io = io;
    this.broadcastRoomState = broadcastRoomState || (() => {});
    this.turnCoordinator = new TurnCoordinator(io, this);
    this.eventCounters = new Map();
    this.botTimers = new Map();
  }

  getNextEventId(roomCode) {
    const count = (this.eventCounters.get(roomCode) || 0) + 1;
    this.eventCounters.set(roomCode, count);
    return `evt_${Date.now()}_${count}`;
  }

  getActionId(gameState, event) {
    return event.actionId || gameState.lastAction?.actionId || `transition_${gameState.stateVersion}`;
  }

  projectEventForPlayer(event, gameState, recipientPlayerId) {
    const projected = { ...event };
    if (projected.type === 'CARD_DRAWN') {
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

    for (const player of room.players) {
      if (player.socketId) {
        const secret = core.getPrivatePlayerState(gs, player.id);
        const snapshot = {
          roomId: roomCode,
          stateVersion: gs.stateVersion,
          serverTime: Date.now(),
          publicState: core.getPublicGameState(gs),
          privateState: secret,
        };
        this.io.to(player.socketId).emit(SOCKET_EVENTS.GAME_SNAPSHOT, snapshot);
      }
    }
  }

  async handleCommand(roomCode, command) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room || !room.gameStateObject) {
      throw new Error('방을 찾을 수 없습니다.');
    }
    if (room.isPaused && command.type !== 'FORFEIT') {
      throw new Error('재접속을 기다리는 동안 게임이 일시 정지되었습니다.');
    }

    const { nextState, events } = core.executeCommand(room.gameStateObject, command);
    this.applyGameStateToRoom(room, nextState);
    await roomRepository.saveRoom(room);

    for (const ev of events) {
      this.broadcastGameEvent(roomCode, nextState, ev);
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
    const baseState = room.gameStateObject || core.createInitialGameState(players, {
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
    this.applyGameStateToRoom(room, nextState);
    await roomRepository.saveRoom(room);
    for (const event of events) this.broadcastGameEvent(roomCode, nextState, event);
    this.broadcastGameSnapshot(roomCode, room);
    this.broadcastRoomState(this.io, roomCode);
    this.scheduleTurnTimeout(roomCode, nextState);
    this.scheduleNextTurnIfBot(roomCode);
    return { nextState, events };
  }

  scheduleTurnTimeout(roomCode, gameState) {
    if (gameState.matchState !== 'PLAYING' || gameState.playPhase !== 'TURN_INPUT' || !gameState.currentTurnPlayerId) {
      this.turnCoordinator.clearTurnTimer(roomCode);
      return;
    }
    if (gameState.config.turnTimeoutSeconds <= 0) return;
    const playerId = gameState.currentTurnPlayerId;
    this.turnCoordinator.startTurnTimer(roomCode, gameState.turnExpiresAt, () => {
      roomRepository.getRoom(roomCode).then((room) => {
        if (room?.isPaused) return;
        return this.handleCommand(roomCode, { type: 'TIMEOUT_FORFEIT', playerId });
      }).catch((error) => {
        console.error('Turn timeout command failed:', error.message);
      });
    });
  }

  clearBotTimer(roomCode) {
    const timer = this.botTimers.get(roomCode);
    if (timer) clearTimeout(timer);
    this.botTimers.delete(roomCode);
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
    await roomRepository.saveRoom(room);
    this.broadcastRoomState(this.io, roomCode);
  }

  async resumeRoom(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject || !room.isPaused) return;

    const now = Date.now();
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

    if (currentTurnPlayer && currentTurnPlayer.isBot && !currentTurnPlayer.isEliminated) {
      this.clearBotTimer(roomCode);
      const botTimer = setTimeout(async () => {
        this.botTimers.delete(roomCode);
        const latestRoom = await roomRepository.getRoom(roomCode);
        if (!latestRoom || !latestRoom.gameStateObject || latestRoom.isPaused) return;
        const latestGs = latestRoom.gameStateObject;
        if (latestGs.currentTurnPlayerId !== currentTurnPlayer.id || latestGs.matchState !== 'PLAYING') return;

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
      }, 1400);
      botTimer.unref?.();
      this.botTimers.set(roomCode, botTimer);
    }
  }
}

export const createLoveLetterService = (io, options) => new LoveLetterService(io, options);
