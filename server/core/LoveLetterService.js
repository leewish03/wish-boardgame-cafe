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

export class LoveLetterService {
  constructor(io) {
    this.io = io;
    this.turnCoordinator = new TurnCoordinator(io, this);
    this.eventCounters = new Map();
  }

  getNextEventId(roomCode) {
    const count = (this.eventCounters.get(roomCode) || 0) + 1;
    this.eventCounters.set(roomCode, count);
    return `evt_${Date.now()}_${count}`;
  }

  broadcastGameEvent(roomCode, gameState, event, actionId) {
    const envelope = {
      eventId: this.getNextEventId(roomCode),
      actionId: actionId || `act_${Date.now()}`,
      stateVersion: gameState.stateVersion,
      timestamp: Date.now(),
      event,
    };
    this.io.to(roomCode).emit(SOCKET_EVENTS.GAME_EVENT, envelope);
  }

  broadcastGameSnapshot(roomCode, room) {
    if (!room || !room.gameStateObject) return;
    const gs = room.gameStateObject;

    for (const player of room.players) {
      if (player.socketId) {
        const secret = gs.secrets[player.id];
        const snapshot = {
          roomId: roomCode,
          stateVersion: gs.stateVersion,
          serverTime: Date.now(),
          game: {
            ...gs,
            secrets: undefined,
          },
          mySecretHand: secret ? secret.hand : [],
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

    const { nextState, events } = core.executeCommand(room.gameStateObject, command);
    room.gameStateObject = nextState;
    room.gameState = nextState.matchState;
    await roomRepository.saveRoom(room);

    for (const ev of events) {
      this.broadcastGameEvent(roomCode, nextState, ev, command.cardId);
    }

    this.broadcastGameSnapshot(roomCode, room);
    this.scheduleNextTurnIfBot(roomCode);

    return { nextState, events };
  }

  async scheduleNextTurnIfBot(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room || !room.gameStateObject || room.gameStateObject.matchState !== 'PLAYING') return;

    const gs = room.gameStateObject;
    const currentTurnPlayer = gs.players.find(p => p.id === gs.currentTurnPlayerId);

    if (currentTurnPlayer && currentTurnPlayer.isBot && !currentTurnPlayer.isEliminated) {
      setTimeout(async () => {
        const latestRoom = await roomRepository.getRoom(roomCode);
        if (!latestRoom || !latestRoom.gameStateObject) return;
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
    }
  }
}

export const createLoveLetterService = (io) => new LoveLetterService(io);
