// =========================================================================
// Room Manager Module - In-Memory Room & Player State Management
// =========================================================================

import { roomRepository } from '../core/RoomRepository.js';
import {
  pauseGameTimer,
  resumeGameTimer,
  handleForfeitedPlayer,
} from '../games/love-letter.js';
import { createBotPlayer } from '../games/love-letter-ai.js';

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
let coreGameLifecycle = null;

export function configureCoreGameLifecycle(handlers) {
  coreGameLifecycle = handlers;
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
  let mapping = socketToUser[socket.id];
  const { roomCode, userId, playerId } = payload || {};
  let code = (mapping?.roomCode || roomCode || '').toUpperCase().trim();
  let uId = mapping?.userId || userId || playerId;
  let room = rooms[code];

  // Fallback: search across all active rooms if socket/user is registered
  if (!room) {
    const allRooms = Array.from(roomRepository._rooms.values());
    const found = allRooms.find((r) =>
      r.players.some((p) => p.socketId === socket.id || (uId && p.id === uId))
    );
    if (found) {
      room = found;
      code = found.code;
      const pl = found.players.find((p) => p.socketId === socket.id || (uId && p.id === uId));
      if (pl) uId = pl.id;
    }
  }

  // Auto-heal socket mapping and room join
  if (room && uId) {
    const player = room.players.find((p) => p.id === uId);
    if (player) {
      if (player.socketId !== socket.id) {
        if (player.socketId && socketToUser[player.socketId]) {
          delete socketToUser[player.socketId];
        }
        player.socketId = socket.id;
      }
      player.isDisconnected = false;
      player.disconnectedAt = null;
      socketToUser[socket.id] = { roomCode: code, userId: uId };
      socket.join(code);
    }
  }

  return { room, roomCode: code, userId: uId, playerId: uId };
}

export function getPublicRoomState(room, requestUserId = null) {
  if (!room) return null;

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
      chatMessages: (room.chatMessages || []).slice(-30),
      isPaused: !!room.isPaused,
      pausedPlayerId: room.pausedPlayerId || null,
      pauseExpiresAt: room.pauseExpiresAt || null,
      players: game.players.map((player) => {
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
    turnTimeLimit: room.turnTimeLimit || 60,
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

export function handlePauseExpired(io, roomCode, userId) {
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
    handleForfeitedPlayer(io, room, userId);
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
          turnTimeLimit: Number(turnTimeLimit) || 60,
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

        // Notify WebRTC peer join
        socket.to(code).emit('webrtc:peer-joined', { newUserId: userId });

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
        const { roomCode, userId, playerId, sessionToken } = payload || {};
        const code = (roomCode || '').toUpperCase().trim();
        const room = rooms[code];
        const targetId = userId || playerId;

        if (!room) {
          if (typeof callback === 'function') {
            callback({ success: false, error: '방이 존재하지 않거나 이미 종료되었습니다.' });
          }
          return;
        }

        const player = room.players.find((p) => p.id === targetId);
        if (!player) {
          if (typeof callback === 'function') {
            callback({ success: false, error: '해당 방에 등록된 플레이어가 아닙니다.' });
          }
          return;
        }

        if (player.sessionToken && sessionToken && player.sessionToken !== sessionToken) {
          if (typeof callback === 'function') {
            callback({ success: false, error: '세션 토큰이 유효하지 않습니다.' });
          }
          return;
        }

        // Clean up previous socket mapping if socketId changed
        if (player.socketId && player.socketId !== socket.id) {
          delete socketToUser[player.socketId];
        }

        player.socketId = socket.id;
        player.isDisconnected = false;
        player.disconnectedAt = null;
        socketToUser[socket.id] = { roomCode: code, userId: player.id };
        socket.join(code);

        // Check if room was paused because of this player (or any player)
        if (room.isPaused && (room.pausedPlayerId === player.id || !room.players.some((p) => p.isDisconnected))) {
          const pausedId = room.pausedPlayerId || player.id;
          if (room.pauseTimeout) {
            clearTimeout(room.pauseTimeout);
            room.pauseTimeout = null;
          }
          room.stateVersion = (room.stateVersion || 0) + 1;
          if (room.gameStateObject && coreGameLifecycle?.resume) {
            await coreGameLifecycle.resume(code);
          } else {
            resumeGameTimer(io, room, pausedId);
          }
        }

        // Notify WebRTC peer reconnect
        socket.to(code).emit('webrtc:peer-reconnected', { userId: player.id });

        const publicState = getPublicRoomState(room, player.id);
        if (typeof callback === 'function') {
          callback({
            success: true,
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
        console.error('room:reconnect error:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: '재접속 처리 중 오류가 발생했습니다.' });
        }
      }
    });

    // 3.1 Session Heartbeat & State Verification
    socket.on('session:heartbeat', (payload, callback) => {
      try {
        let mapping = socketToUser[socket.id];
        const { roomCode, userId, playerId, sessionToken } = payload || {};
        const code = (mapping?.roomCode || roomCode || '').toUpperCase().trim();
        const uId = mapping?.userId || userId || playerId;
        const room = rooms[code];

        if (!room) {
          if (typeof callback === 'function') callback({ success: false, error: '방 없음' });
          return;
        }

        const player = room.players.find((p) => p.id === uId);
        if (!player) {
          if (typeof callback === 'function') callback({ success: false, error: '플레이어 없음' });
          return;
        }

        if (sessionToken && player.sessionToken && player.sessionToken !== sessionToken) {
          if (typeof callback === 'function') callback({ success: false, error: '인증 실패' });
          return;
        }

        // Auto-heal socket mapping if missing or changed
        if (!mapping || player.socketId !== socket.id) {
          if (player.socketId && player.socketId !== socket.id) {
            delete socketToUser[player.socketId];
          }
          player.socketId = socket.id;
          socketToUser[socket.id] = { roomCode: code, userId: uId };
          socket.join(code);
        }

        if (player.isDisconnected) {
          player.isDisconnected = false;
          player.disconnectedAt = null;
        }

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
        console.error('session:heartbeat error:', err);
        if (typeof callback === 'function') callback({ success: false, error: '하트비트 오류' });
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
        if (typeof callback === 'function') callback({ success: false, error: '준비 상태 변경 오류' });
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
        broadcastRoomState(io, roomCode);
        if (typeof callback === 'function') callback({ success: true, bot });
      } catch (err) {
        console.error('room:add-bot error:', err);
        if (typeof callback === 'function') callback({ success: false, error: '봇 추가 중 오류 발생' });
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
        room.stateVersion = (room.stateVersion || 0) + 1;
        broadcastRoomState(io, roomCode);
        if (typeof callback === 'function') callback({ success: true, removedBotId: removed.id });
      } catch (err) {
        console.error('room:remove-bot error:', err);
        if (typeof callback === 'function') callback({ success: false, error: '봇 제거 중 오류 발생' });
      }
    });

    // 5. Chat Message
    socket.on('chat:message', (payload) => {
      try {
        const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (!room) return;

        const sender = room.players.find((p) => p.id === userId);
        if (!sender || !payload?.text?.trim()) return;

        const msg = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          userId: sender.id,
          nickname: sender.nickname,
          avatarUrl: sender.avatarUrl,
          text: payload.text.trim(),
          timestamp: Date.now(),
        };

        if (!room.chatMessages) room.chatMessages = [];
        room.chatMessages.push(msg);

        io.to(roomCode).emit('chat:message', msg);
      } catch (err) {
        console.error('chat:message error:', err);
      }
    });

    // 6. Explicit Forfeit / Leave Room
    const handleForfeit = async (payload, callback) => {
      try {
        let mapping = socketToUser[socket.id];
        const { roomCode, userId, playerId } = payload || {};
        const code = (mapping?.roomCode || roomCode || '').toUpperCase().trim();
        const uId = mapping?.userId || userId || playerId;
        delete socketToUser[socket.id];

        const room = rooms[code];
        if (!room) {
          if (typeof callback === 'function') callback({ success: true });
          return;
        }

        socket.leave(code);
        socket.to(code).emit('webrtc:peer-left', { leftUserId: uId });

        if (room.pauseTimeout && room.pausedPlayerId === uId) {
          clearTimeout(room.pauseTimeout);
          room.pauseTimeout = null;
          room.isPaused = false;
          room.pausedPlayerId = null;
          room.pauseExpiresAt = null;
        }

        if (room.gameStateObject && coreGameLifecycle?.forfeit) {
          await coreGameLifecycle.forfeit(code, uId);
        } else if (room.gameState === 'PLAYING') {
          handleForfeitedPlayer(io, room, uId, true);
        } else {
          room.players = room.players.filter((p) => p.id !== uId);
          room.stateVersion = (room.stateVersion || 0) + 1;
        }

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

        broadcastRoomState(io, code);
        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error('room:forfeit error:', err);
        if (typeof callback === 'function') callback({ success: true });
      }
    };

    socket.on('room:forfeit', handleForfeit);
    socket.on('room:leave', handleForfeit);

    // 7. Socket Disconnect Handler
    socket.on('disconnect', async () => {
      const mapping = socketToUser[socket.id];
      if (!mapping) return;
      const { roomCode, userId } = mapping;
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
      // Pause game and start 3-minute (180s) grace timer
      if (room.gameState === 'PLAYING' || room.gameState === 'ROUND_END') {
        if (room.gameStateObject && coreGameLifecycle?.pause) {
          await coreGameLifecycle.pause(roomCode, userId);
          return;
        }
        if (!room.isPaused) {
          room.isPaused = true;
          room.pausedPlayerId = userId;
          room.pauseExpiresAt = Date.now() + 180000;

          pauseGameTimer(room);

          if (room.pauseTimeout) clearTimeout(room.pauseTimeout);
          room.pauseTimeout = setTimeout(() => {
            handlePauseExpired(io, roomCode, userId);
          }, 180000);
        }

        broadcastRoomState(io, roomCode);
      }
    });
  });
}
