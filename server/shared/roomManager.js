// =========================================================================
// Room Manager Module - In-Memory Room & Player State Management
// =========================================================================

import { roomRepository } from '../core/RoomRepository.js';
import {
  pauseGameTimer,
  resumeGameTimer,
  handleForfeitedPlayer,
} from '../games/love-letter.js';
import { createBotPlayer } from '../core/AiBotController.js';
import { RECONNECT_GRACE_MS } from './reconnectPolicy.js';

export { roomRepository };

// Backward-compatible Proxy object wrapping roomRepository for synchronous access
export const rooms = new Proxy({}, {
  get(target, prop) {
    if (typeof prop === 'string') {
      const code = prop.toUpperCase().trim();
      return roomRepository._rooms.get(code);
    }
    return Reflect.get(target, prop);
  },
  set(target, prop, value) {
    if (typeof prop === 'string') {
      const code = prop.toUpperCase().trim();
      if (value) {
        value.code = value.code || code;
        roomRepository._rooms.set(code, value);
      } else {
        roomRepository._rooms.delete(code);
      }
      return true;
    }
    return Reflect.set(target, prop, value);
  },
  deleteProperty(target, prop) {
    if (typeof prop === 'string') {
      const code = prop.toUpperCase().trim();
      roomRepository._rooms.delete(code);
      void roomRepository.deleteRoom(code).catch((error) => {
        console.error('Failed to delete persisted room:', error);
      });
      return true;
    }
    return Reflect.deleteProperty(target, prop);
  },
  ownKeys() {
    return Array.from(roomRepository._rooms.keys());
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop === 'string' && roomRepository._rooms.has(prop.toUpperCase().trim())) {
      return {
        enumerable: true,
        configurable: true,
        value: roomRepository._rooms.get(prop.toUpperCase().trim()),
      };
    }
    return undefined;
  },
  has(target, prop) {
    if (typeof prop === 'string') {
      return roomRepository._rooms.has(prop.toUpperCase().trim());
    }
    return false;
  },
});

export const socketToUser = {}; // key: socketId -> { roomCode, userId }

// The lobby remains deliberately game-agnostic.  The active Love Letter
// runtime injects these hooks so reconnect/disconnect handling never calls
// the retired mutable rule engine for a core-backed room.
const gameLifecycles = new Map();

export function configureCoreGameLifecycle(handlers) {
  gameLifecycles.set('LOVE_LETTER', handlers);
}

export function configureGameLifecycle(gameType, handlers) {
  gameLifecycles.set(String(gameType || '').toUpperCase(), handlers);
}

function lifecycleForRoom(room) {
  return gameLifecycles.get(room?.gameType || 'LOVE_LETTER') || null;
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms[code] ? generateRoomCode() : code;
}

export function generateSessionToken(userId) {
  return `token_${userId}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
}

export function resolveRoomAndUser(socket, payload = {}) {
  const mapping = socketToUser[socket.id];
  const code = String(mapping?.roomCode || payload?.roomCode || '').toUpperCase().trim();
  const userId = mapping?.userId || payload?.userId || payload?.playerId || null;
  if (!mapping) throw sessionError(socket, payload, code && !rooms[code] ? 'ROOM_NOT_FOUND' : 'SESSION_NOT_BOUND', code, userId);
  if ((payload?.roomCode && String(payload.roomCode).toUpperCase().trim() !== code)
    || (payload?.userId && payload.userId !== userId) || (payload?.playerId && payload.playerId !== userId)) {
    throw sessionError(socket, payload, 'SESSION_CONTEXT_MISMATCH', code, userId);
  }
  const room = rooms[code];
  if (!room) throw sessionError(socket, payload, 'ROOM_NOT_FOUND', code, userId);
  const player = room.players.find(p => p.id === userId);
  if (!player) throw sessionError(socket, payload, 'PLAYER_REMOVED', code, userId);
  if (player.takenOverByBot) throw sessionError(socket, payload, 'SEAT_TAKEN_OVER', code, userId);
  if (player.socketId !== socket.id) throw sessionError(socket, payload, 'SESSION_NOT_BOUND', code, userId);
  return { room, roomCode: code, userId, playerId: userId, player };
}

const sessionMessages = {
  ROOM_NOT_FOUND: '방을 찾을 수 없습니다.', PLAYER_REMOVED: '이 방의 참가가 종료되었습니다.',
  SEAT_TAKEN_OVER: 'AI가 이어받은 자리입니다.', SESSION_INVALID: '세션 토큰이 유효하지 않습니다.',
  SESSION_NOT_BOUND: '재접속 인증이 필요합니다.', SESSION_CONTEXT_MISMATCH: '현재 방 세션과 요청이 일치하지 않습니다.',
};

export function sessionError(socket, payload, code, roomCode, userId) {
  const error = Object.assign(new Error(sessionMessages[code]), {
    code, roomCode: roomCode || null, userId: userId || null, requestId: payload?.requestId,
  });
  if (['ROOM_NOT_FOUND', 'PLAYER_REMOVED', 'SEAT_TAKEN_OVER'].includes(code)) {
    socket.emit('room:unavailable', { ...error, error: error.message });
    const mapping = socketToUser[socket.id];
    if (mapping?.roomCode === roomCode && mapping?.userId === userId) {
      socket.data?.leaveVoiceRoom?.(mapping);
      delete socketToUser[socket.id];
      socket.leave(roomCode);
    }
  }
  return error;
}

export function sessionFailure(error) {
  return { success: false, error: error.message || String(error), ...(error.code ? {
    code: error.code, roomCode: error.roomCode, userId: error.userId, requestId: error.requestId,
  } : {}) };
}

export function authenticateRoomSession(socket, payload = {}) {
  const code = String(payload.roomCode || '').toUpperCase().trim();
  const userId = payload.userId || payload.playerId;
  const room = rooms[code];
  if (!room) throw sessionError(socket, payload, 'ROOM_NOT_FOUND', code, userId);
  const player = room.players.find(p => p.id === userId);
  if (!player) throw sessionError(socket, payload, 'PLAYER_REMOVED', code, userId);
  if (player.takenOverByBot) throw sessionError(socket, payload, 'SEAT_TAKEN_OVER', code, userId);
  if (!payload.sessionToken || !player.sessionToken || payload.sessionToken !== player.sessionToken) {
    throw sessionError(socket, payload, 'SESSION_INVALID', code, userId);
  }
  return { room, roomCode: code, userId, player };
}

export function bindRoomSession(socket, { room, roomCode, userId, player }) {
  const previous = socketToUser[socket.id];
  if (previous && (previous.roomCode !== roomCode || previous.userId !== userId)) {
    throw sessionError(socket, {}, 'SESSION_CONTEXT_MISMATCH', roomCode, userId);
  }
  if (player.socketId && player.socketId !== socket.id) {
    const oldSocket = socket.nsp.sockets.get(player.socketId);
    oldSocket?.leave(roomCode);
    delete socketToUser[player.socketId];
  }
  player.socketId = socket.id;
  player.isDisconnected = false;
  player.disconnectedAt = null;
  socketToUser[socket.id] = { roomCode, userId };
  socket.join(roomCode);
}

export function isRoomSessionCurrent(socket, { room, roomCode, userId, player }) {
  return socket.connected && rooms[roomCode] === room && room.players.includes(player)
    && player.socketId === socket.id && socketToUser[socket.id]?.roomCode === roomCode
    && socketToUser[socket.id]?.userId === userId;
}

export function getPublicRoomState(room, requestUserId = null) {
  if (!room) return null;

  const lifecycle = lifecycleForRoom(room);
  if (room.gameStateObject && lifecycle?.projectPublicState) {
    return lifecycle.projectPublicState(room, requestUserId);
  }

  if (room.gameStateObject) {
    const game = room.gameStateObject;
    return {
      code: room.code,
      gameType: room.gameType || 'LOVE_LETTER',
      hostId: room.hostId,
      gameState: game.matchState,
      playPhase: game.playPhase,
      stateVersion: game.stateVersion,
      serverTime: Date.now(),
      targetTokens: game.config.targetTokens,
      maxPlayers: game.config.maxPlayers,
      turnTimeLimit: game.config.turnTimeoutSeconds,
      deckCount: game.deck.length,
      turnPlayerId: game.currentTurnPlayerId,
      turnExpiresAt: game.turnExpiresAt,
      roundNumber: game.roundNumber,
      setAsideCardCount: game.setAsideCard ? 1 : 0,
      outcome: game.outcome || null,
      roundWinnerIds: game.roundWinnerIds || [],
      roundWinnerReason: game.roundWinnerReason || game.outcome?.reason || null,
      matchWinnerId: game.matchWinnerId || null,
      lastAction: game.lastAction?.resultType === 'PRIEST_REVEAL'
        ? { ...game.lastAction, revealedCard: undefined }
        : game.lastAction || null,
      chatMessages: (room.chatMessages || []).slice(-30),
      isPaused: !!room.isPaused,
      pausedPlayerId: room.pausedPlayerId || null,
      pauseExpiresAt: room.pauseExpiresAt || null,
      players: (game.outcome?.reason === 'INSUFFICIENT_HUMANS'
        ? game.players.filter((player) => room.players.some((member) => member.id === player.id))
        : game.players
      ).map((player) => {
        const sessionPlayer = room.players.find((candidate) => candidate.id === player.id);
        const isSelf = player.id === requestUserId;
        return {
          ...player,
          playerId: player.id,
          avatarUrl: player.avatarUrl || player.avatar,
          isDisconnected: !!sessionPlayer?.isDisconnected,
          disconnectedAt: sessionPlayer?.disconnectedAt || null,
          handCount: player.cardCount,
          hand: isSelf ? game.secrets[player.id]?.hand || [] : [],
        };
      }),
    };
  }

  return {
    code: room.code,
    gameType: room.gameType || 'LOVE_LETTER',
    hostId: room.hostId,
    gameState: room.gameState, // 'LOBBY' | 'PLAYING' | 'ROUND_END' | 'GAME_OVER'
    playPhase: room.playPhase || (room.gameState === 'PLAYING' ? 'TURN_INPUT' : room.gameState),
    stateVersion: room.stateVersion || 1,
    serverTime: Date.now(),
    targetTokens: room.targetTokens || 4,
    maxPlayers: room.maxPlayers || 4,
    turnTimeLimit: room.turnTimeLimit ?? 60,
    deckCount: room.deck ? room.deck.length : 0,
    setAsideOpenCards: room.setAsideOpenCards || [],
    turnPlayerId: room.turnPlayerId,
    turnStartTime: room.turnStartTime || null,
    turnExpiresAt: room.turnExpiresAt || null,
    roundNumber: room.roundNumber || 1,
    roundWinner: room.roundWinner,
    gameWinner: room.gameWinner,
    lastActionLog: room.lastActionLog || null,
    lastActionDetail: room.lastActionDetail || null,
    actionLogs: room.actionLogs || [],
    chatMessages: (room.chatMessages || []).slice(-30),
    isPaused: !!room.isPaused,
    pausedPlayerId: room.pausedPlayerId || null,
    pauseExpiresAt: room.pauseExpiresAt || null,
    autoAdvanceExpiresAt: room.autoAdvanceExpiresAt || null,
    players: room.players.map((p) => {
      const isSelf = p.id === requestUserId;
      return {
        id: p.id,
        playerId: p.id,
        nickname: p.nickname || p.name || '플레이어',
        avatarUrl: p.avatarUrl || p.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.id}`,
        isHost: p.id === room.hostId,
        isBot: !!p.isBot,
        personality: p.personality || null,
        isReady: p.isReady,
        tokens: p.tokens || 0,
        isEliminated: p.isEliminated || false,
        isProtected: p.isProtected || false,
        isDisconnected: p.isDisconnected || false,
        disconnectedAt: p.disconnectedAt || null,
        discardPile: p.discardPile || [],
        handCount: p.hand ? p.hand.length : 0,
        hand: isSelf ? p.hand : [], // Only expose hand to self
      };
    }),
  };
}

export function broadcastRoomState(io, roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  void roomRepository.saveRoom(room).catch((error) => {
    console.error('Failed to persist room state:', error);
  });

  room.players.forEach((p) => {
    if (p.socketId) {
      const state = getPublicRoomState(room, p.id);
      io.to(p.socketId).emit('room:state', state);
    }
  });
}

function appendRoomMessage(room, message) {
  if (!room) return null;
  if (!room.chatMessages) room.chatMessages = [];
  const entry = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...message,
  };
  room.chatMessages.push(entry);
  // Keep the durable room payload bounded just like the public projection.
  if (room.chatMessages.length > 100) room.chatMessages.splice(0, room.chatMessages.length - 100);
  return entry;
}

function emitSystemMessage(io, roomCode, room, text) {
  const message = appendRoomMessage(room, { type: 'system', text });
  if (message) io.to(roomCode).emit('chat:message', message);
  return message;
}

function openRoomSummary(room) {
  const game = room.gameStateObject;
  const players = game?.outcome?.reason === 'INSUFFICIENT_HUMANS'
    ? (room.players || [])
    : (game?.players || room.players || []);
  return {
    id: `room_${String(room.code || '').slice(-2)}`,
    gameType: room.gameType || 'LOVE_LETTER',
    hostName: players.find((player) => player.id === room.hostId)?.nickname || '방장',
    playerCount: players.length,
    humanCount: players.filter((player) => !player.isBot).length,
    botCount: players.filter((player) => player.isBot).length,
    connectedCount: (room.players || []).filter((player) => !player.isDisconnected).length,
    maxPlayers: game?.config?.maxPlayers || room.maxPlayers || 4,
    targetTokens: game?.config?.targetTokens || room.targetTokens || 4,
    roundCount: game?.config?.roundCount || room.roundCount || null,
    roundNumber: game?.roundNumber || room.roundNumber || 1,
    status: room.isPaused ? 'RECONNECTING' : (game?.matchState || room.gameState || 'LOBBY'),
    updatedAt: room.updatedAt || room.createdAt || Date.now(),
  };
}

export async function handlePauseExpired(io, roomCode, userId) {
  const room = rooms[roomCode];
  if (!room) return;

  const player = room.players.find((p) => p.id === userId);
  if (!player || !player.isDisconnected) {
    return; // Already reconnected
  }

  room.pauseTimeout = null;
  room.isPaused = false;
  room.pausedPlayerId = null;
  room.pauseExpiresAt = null;
  room.stateVersion = (room.stateVersion || 0) + 1;

  if (room.gameState === 'PLAYING' || room.gameState === 'ROUND_END') {
    const lifecycle = lifecycleForRoom(room);
    if (room.gameStateObject && lifecycle?.disconnectExpired) {
      await lifecycle.disconnectExpired(roomCode, userId);
      emitSystemMessage(io, roomCode, room, `${player.nickname}님의 자리를 AI가 이어받았습니다.`);
      await roomRepository.saveRoom(room);
      broadcastRoomState(io, roomCode);
    } else if (room.gameStateObject && lifecycle?.forfeit) {
      await lifecycle.forfeit(roomCode, userId);
      room.players = room.players.filter((candidate) => candidate.id !== userId);
      emitSystemMessage(io, roomCode, room, `${player.nickname}님이 재접속하지 않아 퇴장했습니다.`);
      if (room.hostId === userId && room.players.length) {
        room.hostId = room.players[0].id;
        room.players[0].isHost = true;
        room.players[0].isReady = true;
      }
      await roomRepository.saveRoom(room);
      broadcastRoomState(io, roomCode);
    } else {
      handleForfeitedPlayer(io, room, userId);
    }
  } else {
    room.players = room.players.filter((p) => p.id !== userId);
    if (room.players.length === 0) {
      delete rooms[roomCode];
      return;
    }
    if (room.hostId === userId) {
      room.hostId = room.players[0].id;
      room.players[0].isReady = true;
    }
    broadcastRoomState(io, roomCode);
  }
}

export function initRoomManager(io) {
  io.on('connection', (socket) => {
    socket.on('room:list', (_payload, callback) => {
      const publicRooms = Array.from(roomRepository._rooms.values())
        .filter((room) => (room.players || []).length > 0)
        .map(openRoomSummary);
      if (typeof callback === 'function') callback({ success: true, rooms: publicRooms, serverTime: Date.now() });
    });
    // 1. Create Room
    socket.on('room:create', (payload, callback) => {
      try {
        const {
          gameType = 'LOVE_LETTER',
          nickname = '방장',
          avatarUrl,
          targetTokens = 4,
          maxPlayers = 4,
          turnTimeLimit = 60,
          roundCount = 10,
          useStrippedDeck = true,
          philanthropicScoring = false,
          merchantExchange = false,
        } = payload || {};

        const roomCode = generateRoomCode();
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const sessionToken = generateSessionToken(userId);
        const avatar =
          avatarUrl ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(nickname || userId)}`;

        const player = {
          id: userId,
          playerId: userId,
          sessionToken,
          socketId: socket.id,
          nickname,
          avatarUrl: avatar,
          isHost: true,
          isReady: true, // Host is ready by default
          tokens: 0,
          isEliminated: false,
          isProtected: false,
          hand: [],
          discardPile: [],
          isDisconnected: false,
          disconnectedAt: null,
        };

        const newRoom = {
          code: roomCode,
          id: roomCode,
          gameType,
          hostId: userId,
          gameState: 'LOBBY',
          playPhase: 'LOBBY',
          stateVersion: 1,
          targetTokens: Number(targetTokens) || 4,
          maxPlayers: Number(maxPlayers) || 4,
          // Zero is an intentional setting for an untimed table. Do not use a
          // truthy fallback here or the waiting room and authoritative engine
          // silently disagree about the rule the host selected.
          turnTimeLimit: Number.isFinite(Number(turnTimeLimit)) ? Number(turnTimeLimit) : 60,
          roundCount: [5, 10, 20].includes(Number(roundCount)) ? Number(roundCount) : 10,
          useStrippedDeck: useStrippedDeck !== false,
          philanthropicScoring: !!philanthropicScoring,
          merchantExchange: !!merchantExchange,
          players: [player],
          deck: [],
          setAsideSecretCard: null,
          setAsideOpenCards: [],
          turnPlayerId: null,
          turnTimer: null,
          turnStartTime: null,
          turnExpiresAt: null,
          roundNumber: 1,
          roundWinner: null,
          roundWinnerId: null,
          gameWinner: null,
          actionLogs: [],
          chatMessages: [],
          lastActionLog: '방이 생성되었습니다.',
          lastActionDetail: null,
          isPaused: false,
          pausedPlayerId: null,
          pauseExpiresAt: null,
          pauseTimeout: null,
          savedTurnRemainingMs: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        rooms[roomCode] = newRoom;
        socketToUser[socket.id] = { roomCode, userId };
        socket.join(roomCode);

        if (typeof callback === 'function') {
          callback({
            success: true,
            roomCode,
            userId,
            playerId: userId,
            sessionToken,
            player,
          });
        }

        broadcastRoomState(io, roomCode);
      } catch (err) {
        console.error('room:create error:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: '방 생성 중 오류가 발생했습니다.' });
        }
      }
    });

    // 2. Join Room
    socket.on('room:join', (payload, callback) => {
      try {
        const { roomCode, nickname = '플레이어', avatarUrl } = payload || {};
        const code = (roomCode || '').toUpperCase().trim();
        const room = rooms[code];

        if (!room) {
          if (typeof callback === 'function') {
            callback({ success: false, error: '존재하지 않는 방 코드입니다.' });
          }
          return;
        }

        if (room.gameState !== 'LOBBY') {
          if (typeof callback === 'function') {
            callback({ success: false, error: '이미 게임이 시작된 방입니다.' });
          }
          return;
        }

        if (room.players.length >= room.maxPlayers) {
          if (typeof callback === 'function') {
            callback({ success: false, error: '방이 꽉 찼습니다.' });
          }
          return;
        }

        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const sessionToken = generateSessionToken(userId);
        const avatar =
          avatarUrl ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(nickname || userId)}`;

        const player = {
          id: userId,
          playerId: userId,
          sessionToken,
          socketId: socket.id,
          nickname,
          avatarUrl: avatar,
          isHost: false,
          isReady: false,
          tokens: 0,
          isEliminated: false,
          isProtected: false,
          hand: [],
          discardPile: [],
          isDisconnected: false,
          disconnectedAt: null,
        };

        room.players.push(player);
        room.stateVersion = (room.stateVersion || 0) + 1;
        socketToUser[socket.id] = { roomCode: code, userId };
        socket.join(code);

        // Room membership is not voice membership. The signalling service
        // announces peers only after the user explicitly joins voice.
        emitSystemMessage(io, code, room, `${player.nickname}님이 입장했습니다.`);

        if (typeof callback === 'function') {
          callback({
            success: true,
            roomCode: code,
            userId,
            playerId: userId,
            sessionToken,
            player,
          });
        }

        broadcastRoomState(io, code);
      } catch (err) {
        console.error('room:join error:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: '방 입장 중 오류가 발생했습니다.' });
        }
      }
    });

    // 3. Reconnect Room
    socket.on('room:reconnect', async (payload, callback) => {
      try {
        const session = authenticateRoomSession(socket, payload);
        const { room, roomCode: code, player } = session;

        // A repeated request from the same connected socket is merely a sync.
        const alreadyConnected = player.socketId === socket.id && !player.isDisconnected;
        bindRoomSession(socket, session);

        // Check if room was paused because of this player (or any player)
        if (room.isPaused && (room.pausedPlayerId === player.id || !room.players.some((p) => p.isDisconnected))) {
          const pausedId = room.pausedPlayerId || player.id;
          if (room.pauseTimeout) {
            clearTimeout(room.pauseTimeout);
            room.pauseTimeout = null;
          }
          room.stateVersion = (room.stateVersion || 0) + 1;
          const lifecycle = lifecycleForRoom(room);
          if (room.gameStateObject && lifecycle?.resume) {
            await lifecycle.resume(code);
          } else {
            resumeGameTimer(io, room, pausedId);
          }
        }

        if (!isRoomSessionCurrent(socket, session)) {
          if (typeof callback === 'function') callback(sessionFailure(sessionError(socket, payload, 'SESSION_NOT_BOUND', code, player.id)));
          return;
        }
        if (!alreadyConnected) {
          emitSystemMessage(io, code, room, `${player.nickname}님이 다시 연결했습니다.`);
        }

        const publicState = getPublicRoomState(room, player.id);
        if (typeof callback === 'function') {
          callback({
            success: true,
            requestId: payload?.requestId,
            alreadyConnected,
            roomCode: code,
            userId: player.id,
            playerId: player.id,
            sessionToken: player.sessionToken,
            player,
            gameState: publicState,
            stateVersion: room.stateVersion,
            serverTime: Date.now(),
          });
        }

        broadcastRoomState(io, code);
      } catch (err) {
        if (!err.code) console.error('room:reconnect error:', err);
        if (typeof callback === 'function') {
          callback(sessionFailure(err));
        }
      }
    });

    // 3.1 Session Heartbeat & State Verification
    socket.on('session:heartbeat', async (payload, callback) => {
      try {
        const session = authenticateRoomSession(socket, payload);
        const { room, roomCode: code, userId: uId, player } = session;
        bindRoomSession(socket, session);

        // Mobile browsers can restore a transport while the app is returning
        // from the keyboard without emitting a distinct reconnect flow. A
        // verified heartbeat is therefore sufficient to release a pause that
        // was created for this same player.
        if (room.isPaused && (room.pausedPlayerId === player.id || !room.players.some((member) => member.isDisconnected))) {
          const pausedId = room.pausedPlayerId || player.id;
          if (room.pauseTimeout) {
            clearTimeout(room.pauseTimeout);
            room.pauseTimeout = null;
          }
          room.stateVersion = (room.stateVersion || 0) + 1;
          const lifecycle = lifecycleForRoom(room);
          if (room.gameStateObject && lifecycle?.resume) {
            await lifecycle.resume(code);
          } else {
            resumeGameTimer(io, room, pausedId);
          }
        }

        if (!isRoomSessionCurrent(socket, session)) return;
        if (typeof callback === 'function') {
          callback({
            success: true,
            roomCode: code,
            userId: uId,
            playerId: uId,
            isPaused: !!room.isPaused,
            pausedPlayerId: room.pausedPlayerId || null,
            pauseExpiresAt: room.pauseExpiresAt || null,
            gameState: room.gameState,
            playPhase: room.playPhase || 'LOBBY',
            turnPlayerId: room.turnPlayerId,
            stateVersion: room.stateVersion || 1,
            serverTime: Date.now(),
          });
        }
      } catch (err) {
        if (!err.code) console.error('session:heartbeat error:', err);
        if (typeof callback === 'function') callback(sessionFailure(err));
      }
    });

    // 4. Ready Toggle
    socket.on('room:ready', (payload, callback) => {
      try {
        const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (!room || room.gameState !== 'LOBBY') {
          if (typeof callback === 'function') callback({ success: false, error: '로비 상태가 아님' });
          return;
        }

        const player = room.players.find((p) => p.id === userId);
        if (player && player.id !== room.hostId) {
          player.isReady = payload?.isReady !== undefined ? !!payload.isReady : !player.isReady;
          room.stateVersion = (room.stateVersion || 0) + 1;
          broadcastRoomState(io, roomCode);
          if (typeof callback === 'function') callback({ success: true, isReady: player.isReady });
        } else {
          if (typeof callback === 'function') callback({ success: true, isReady: true });
        }
      } catch (err) {
        console.error('room:ready error:', err);
        if (typeof callback === 'function') callback(sessionFailure(err));
      }
    });

    // 4.1 Add AI Bot to Room
    socket.on('room:add-bot', (payload, callback) => {
      try {
        const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (!room || room.gameState !== 'LOBBY') {
          if (typeof callback === 'function') callback({ success: false, error: '로비 상태에서만 봇을 추가할 수 있습니다.' });
          return;
        }
        if (room.hostId !== userId) {
          if (typeof callback === 'function') callback({ success: false, error: '방장만 봇을 추가할 수 있습니다.' });
          return;
        }
        if (room.players.length >= room.maxPlayers) {
          if (typeof callback === 'function') callback({ success: false, error: `최대 ${room.maxPlayers}명까지만 입장할 수 있습니다.` });
          return;
        }

        const bot = createBotPlayer(room.players);
        room.players.push(bot);
        room.stateVersion = (room.stateVersion || 0) + 1;
        emitSystemMessage(io, roomCode, room, `${bot.nickname}님이 입장했습니다.`);
        broadcastRoomState(io, roomCode);
        if (typeof callback === 'function') callback({ success: true, bot });
      } catch (err) {
        console.error('room:add-bot error:', err);
        if (typeof callback === 'function') callback(sessionFailure(err));
      }
    });

    // 4.2 Remove AI Bot from Room
    socket.on('room:remove-bot', (payload, callback) => {
      try {
        const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (!room || room.gameState !== 'LOBBY') {
          if (typeof callback === 'function') callback({ success: false, error: '로비 상태에서만 봇을 제거할 수 있습니다.' });
          return;
        }
        if (room.hostId !== userId) {
          if (typeof callback === 'function') callback({ success: false, error: '방장만 봇을 제거할 수 있습니다.' });
          return;
        }

        const { botId } = payload || {};
        let botIdx = -1;
        if (botId) {
          botIdx = room.players.findIndex((p) => p.id === botId && p.isBot);
        } else {
          for (let i = room.players.length - 1; i >= 0; i--) {
            if (room.players[i].isBot) {
              botIdx = i;
              break;
            }
          }
        }

        if (botIdx === -1) {
          if (typeof callback === 'function') callback({ success: false, error: '제거할 수 있는 AI 봇이 없습니다.' });
          return;
        }

        const removed = room.players.splice(botIdx, 1)[0];
        if (room.botKnowledgeByPlayerId) delete room.botKnowledgeByPlayerId[removed.id];
        room.stateVersion = (room.stateVersion || 0) + 1;
        emitSystemMessage(io, roomCode, room, `${removed.nickname}님이 퇴장했습니다.`);
        broadcastRoomState(io, roomCode);
        if (typeof callback === 'function') callback({ success: true, removedBotId: removed.id });
      } catch (err) {
        console.error('room:remove-bot error:', err);
        if (typeof callback === 'function') callback(sessionFailure(err));
      }
    });

    // 5. Chat Message
    socket.on('chat:message', (payload, callback) => {
      try {
        const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (!room) throw new Error('방을 찾을 수 없습니다.');

        const sender = room.players.find((p) => p.id === userId);
        if (!sender || !payload?.text?.trim()) throw new Error('메시지 내용을 입력해 주세요.');

        const msg = appendRoomMessage(room, {
          type: 'chat',
          userId: sender.id,
          nickname: sender.nickname,
          avatarUrl: sender.avatarUrl,
          text: payload.text.trim(),
        });

        io.to(roomCode).emit('chat:message', msg);
        void roomRepository.saveRoom(room);
        if (typeof callback === 'function') callback({ success: true, message: msg });
      } catch (err) {
        console.error('chat:message error:', err);
        if (typeof callback === 'function') callback(sessionFailure(err));
      }
    });

    // 6. Explicit Forfeit / Leave Room
    const handleForfeit = async (payload, callback) => {
      try {
        let { room, roomCode: code, userId: uId } = payload?.sessionToken
          ? authenticateRoomSession(socket, payload) : resolveRoomAndUser(socket, payload);
        if (!room) {
          if (typeof callback === 'function') callback({ success: true });
          return;
        }

        if (!uId) throw new Error('기권할 플레이어를 찾을 수 없습니다.');
        const departingPlayer = room.players.find((player) => player.id === uId);
        const departingSocketId = departingPlayer?.socketId;
        if (departingSocketId) {
          delete socketToUser[departingSocketId];
          io.sockets.sockets.get(departingSocketId)?.leave(code);
        }
        if (departingPlayer) departingPlayer.socketId = null;

        // An explicit departure resolves the reconnect wait for everyone.
        // Previously, if a connected player left while waiting for somebody
        // else, the core forfeit command cleared its expiry timer but the room
        // stayed flagged as paused forever.
        if (room.isPaused) {
          if (room.pauseTimeout) clearTimeout(room.pauseTimeout);
          room.pauseTimeout = null;
          room.isPaused = false;
          room.pausedPlayerId = null;
          room.pauseExpiresAt = null;
          delete room.pausedTurnRemainingMs;
        }

        const lifecycle = lifecycleForRoom(room);
        if (room.gameStateObject && lifecycle?.forfeit) {
          await lifecycle.forfeit(code, uId);
          // Lifecycle services may persist a fresh state transition.  Read it
          // back before touching room metadata so an old room object cannot
          // overwrite the new turn/result state after a departure.
          room = (await roomRepository.getRoom(code)) || room;
          // Core keeps the round outcome for history; the room roster must not
          // deal the departed player into the following round.
          room.players = room.players.filter((player) => player.id !== uId);
        } else if (room.gameState === 'PLAYING') {
          handleForfeitedPlayer(io, room, uId, true);
        } else {
          room.players = room.players.filter((p) => p.id !== uId);
          room.stateVersion = (room.stateVersion || 0) + 1;
        }

        // Remove voice membership before an empty room is discarded as well.
        // Otherwise a reconnect can inherit a stale voice member with no peer
        // notification, which makes the next listen attempt appear frozen.
        socket.data?.leaveVoiceRoom?.({ roomCode: code, userId: uId });
        await roomRepository.saveRoom(room);
        if (room.players.length === 0) {
          if (room.turnTimer) clearTimeout(room.turnTimer);
          delete rooms[code];
          if (typeof callback === 'function') callback({ success: true });
          return;
        }

        if (room.hostId === uId && room.players.length > 0) {
          room.hostId = room.players[0].id;
          room.players[0].isReady = true;
          room.players[0].isHost = true;
        }

        emitSystemMessage(io, code, room, `${departingPlayer?.nickname || '플레이어'}님이 퇴장했습니다.`);
        broadcastRoomState(io, code);
        delete socketToUser[socket.id];
        socket.leave(code);
        socket.to(code).emit('webrtc:peer-left', { leftUserId: uId });
        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error('room:forfeit error:', err);
        if (typeof callback === 'function') callback(sessionFailure(err));
      }
    };

    socket.on('room:forfeit', handleForfeit);
    socket.on('room:leave', async (payload, callback) => {
      try {
        const { room, roomCode, userId } = payload?.sessionToken
          ? authenticateRoomSession(socket, payload) : resolveRoomAndUser(socket, payload);
        if (!room) { if (typeof callback === 'function') callback({ success: true }); return; }
        // Leaving a completed result screen must not run a forfeit command and
        // mutate the already-finished outcome.
        if (room.gameStateObject?.matchState === 'PLAYING' || room.gameState === 'PLAYING') {
          await handleForfeit(payload, callback);
          return;
        }
        socket.data?.leaveVoiceRoom?.({ roomCode, userId });
        delete socketToUser[socket.id];
        socket.leave(roomCode);
        const departingPlayer = room.players.find((player) => player.id === userId);
        if (departingPlayer?.socketId) {
          delete socketToUser[departingPlayer.socketId];
          io.sockets.sockets.get(departingPlayer.socketId)?.leave(roomCode);
        }
        room.players = room.players.filter((player) => player.id !== userId);
        if (room.players.length === 0) {
          delete rooms[roomCode];
        } else {
          if (room.hostId === userId) {
            room.hostId = room.players[0].id;
            room.players[0].isHost = true;
            room.players[0].isReady = true;
          }
          room.stateVersion = (room.stateVersion || 0) + 1;
          emitSystemMessage(io, roomCode, room, `${departingPlayer?.nickname || '플레이어'}님이 퇴장했습니다.`);
          broadcastRoomState(io, roomCode);
        }
        socket.to(roomCode).emit('webrtc:peer-left', { leftUserId: userId });
        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        if (typeof callback === 'function') callback(sessionFailure(err));
      }
    });

    // 7. Socket Disconnect Handler
    socket.on('disconnect', async () => {
      const mapping = socketToUser[socket.id];
      if (!mapping) return;
      const { roomCode, userId } = mapping;
      socket.data?.leaveVoiceRoom?.(mapping);
      delete socketToUser[socket.id];

      const room = rooms[roomCode];
      if (!room) return;

      const player = room.players.find((p) => p.id === userId);
      if (!player) return;

      player.isDisconnected = true;
      player.disconnectedAt = Date.now();
      player.socketId = null;
      room.stateVersion = (room.stateVersion || 0) + 1;

      socket.leave(roomCode);
      socket.to(roomCode).emit('webrtc:peer-left', { leftUserId: userId });

      // If in LOBBY, allow 30 seconds for refresh/reconnect before cleaning up
      if (room.gameState === 'LOBBY') {
        setTimeout(() => {
          const currentRoom = rooms[roomCode];
          if (!currentRoom || currentRoom.gameState !== 'LOBBY') return;
          const p = currentRoom.players.find((pl) => pl.id === userId);
          if (p && p.isDisconnected) {
            currentRoom.players = currentRoom.players.filter((pl) => pl.id !== userId);
            currentRoom.stateVersion = (currentRoom.stateVersion || 0) + 1;
            if (currentRoom.players.length === 0) {
              delete rooms[roomCode];
              return;
            }
            if (currentRoom.hostId === userId) {
              currentRoom.hostId = currentRoom.players[0].id;
              currentRoom.players[0].isReady = true;
              currentRoom.players[0].isHost = true;
            }
            broadcastRoomState(io, roomCode);
          }
        }, 30000);

        broadcastRoomState(io, roomCode);
        return;
      }

      // If in PLAYING or ROUND_END state: DO NOT REMOVE PLAYER!
      // Pause game only long enough for a normal mobile foreground return.
      if (room.gameState === 'PLAYING' || room.gameState === 'ROUND_END') {
        const lifecycle = lifecycleForRoom(room);
        if (room.gameStateObject && lifecycle?.pause) {
          await lifecycle.pause(roomCode, userId);
          return;
        }
        if (!room.isPaused) {
          room.isPaused = true;
          room.pausedPlayerId = userId;
          room.pauseExpiresAt = Date.now() + RECONNECT_GRACE_MS;

          pauseGameTimer(room);

          if (room.pauseTimeout) clearTimeout(room.pauseTimeout);
          room.pauseTimeout = setTimeout(() => {
            void handlePauseExpired(io, roomCode, userId).catch((error) => {
              console.error('Disconnected player expiry failed:', error);
            });
          }, RECONNECT_GRACE_MS);
        }

        broadcastRoomState(io, roomCode);
      }
    });
  });
}
