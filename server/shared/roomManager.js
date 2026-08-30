// =========================================================================
// Room Manager Module - In-Memory Room & Player State Management
// =========================================================================

import {
  pauseGameTimer,
  resumeGameTimer,
  handleForfeitedPlayer,
} from '../games/love-letter.js';

export const rooms = {}; // key: roomCode (UPPERCASE) -> room data
export const socketToUser = {}; // key: socketId -> { roomCode, userId }

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

export function getPublicRoomState(room, requestUserId = null) {
  if (!room) return null;

  return {
    code: room.code,
    gameType: room.gameType || 'LOVE_LETTER',
    hostId: room.hostId,
    gameState: room.gameState, // 'LOBBY' | 'PLAYING' | 'ROUND_END' | 'GAME_OVER'
    targetTokens: room.targetTokens || 4,
    maxPlayers: room.maxPlayers || 4,
    turnTimeLimit: room.turnTimeLimit || 60,
    deckCount: room.deck ? room.deck.length : 0,
    setAsideOpenCards: room.setAsideOpenCards || [],
    turnPlayerId: room.turnPlayerId,
    roundNumber: room.roundNumber || 1,
    roundWinner: room.roundWinner,
    gameWinner: room.gameWinner,
    lastActionLog: room.lastActionLog || null,
    actionLogs: room.actionLogs || [],
    chatMessages: (room.chatMessages || []).slice(-30),
    isPaused: !!room.isPaused,
    pausedPlayerId: room.pausedPlayerId || null,
    pauseExpiresAt: room.pauseExpiresAt || null,
    players: room.players.map((p) => {
      const isSelf = p.id === requestUserId;
      return {
        id: p.id,
        nickname: p.nickname || p.name || '플레이어',
        avatarUrl: p.avatarUrl || p.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.id}`,
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
          sessionToken,
          socketId: socket.id,
          nickname,
          avatarUrl: avatar,
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
          gameType,
          hostId: userId,
          gameState: 'LOBBY',
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
          roundNumber: 1,
          roundWinner: null,
          gameWinner: null,
          actionLogs: [],
          chatMessages: [],
          lastActionLog: '방이 생성되었습니다.',
          isPaused: false,
          pausedPlayerId: null,
          pauseExpiresAt: null,
          pauseTimeout: null,
          savedTurnRemainingMs: null,
        };

        rooms[roomCode] = newRoom;
        socketToUser[socket.id] = { roomCode, userId };
        socket.join(roomCode);

        if (typeof callback === 'function') {
          callback({
            success: true,
            roomCode,
            userId,
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
          sessionToken,
          socketId: socket.id,
          nickname,
          avatarUrl: avatar,
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
        socketToUser[socket.id] = { roomCode: code, userId };
        socket.join(code);

        // Notify WebRTC peer join
        socket.to(code).emit('webrtc:peer-joined', { newUserId: userId });

        if (typeof callback === 'function') {
          callback({
            success: true,
            roomCode: code,
            userId,
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
    socket.on('room:reconnect', (payload, callback) => {
      try {
        const { roomCode, userId, sessionToken } = payload || {};
        const code = (roomCode || '').toUpperCase().trim();
        const room = rooms[code];

        if (!room) {
          if (typeof callback === 'function') {
            callback({ success: false, error: '방이 존재하지 않거나 이미 종료되었습니다.' });
          }
          return;
        }

        const player = room.players.find((p) => p.id === userId);
        if (!player) {
          if (typeof callback === 'function') {
            callback({ success: false, error: '해당 방에 등록된 플레이어가 아닙니다.' });
          }
          return;
        }

        if (player.sessionToken && player.sessionToken !== sessionToken) {
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
        socketToUser[socket.id] = { roomCode: code, userId };
        socket.join(code);

        // Check if room was paused because of this player
        if (room.isPaused && room.pausedPlayerId === userId) {
          if (room.pauseTimeout) {
            clearTimeout(room.pauseTimeout);
            room.pauseTimeout = null;
          }
          resumeGameTimer(io, room);
        }

        // Notify WebRTC peer reconnect
        socket.to(code).emit('webrtc:peer-reconnected', { userId });

        const publicState = getPublicRoomState(room, userId);
        if (typeof callback === 'function') {
          callback({
            success: true,
            roomCode: code,
            userId,
            sessionToken: player.sessionToken,
            player,
            gameState: publicState,
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

    // 4. Ready Toggle
    socket.on('room:ready', (payload) => {
      const mapping = socketToUser[socket.id];
      if (!mapping) return;
      const { roomCode, userId } = mapping;
      const room = rooms[roomCode];
      if (!room || room.gameState !== 'LOBBY') return;

      const player = room.players.find((p) => p.id === userId);
      if (player && player.id !== room.hostId) {
        player.isReady = payload?.isReady !== undefined ? !!payload.isReady : !player.isReady;
        broadcastRoomState(io, roomCode);
      }
    });

    // 5. Chat Message
    socket.on('chat:message', (payload) => {
      const mapping = socketToUser[socket.id];
      if (!mapping) return;
      const { roomCode, userId } = mapping;
      const room = rooms[roomCode];
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
    });

    // 6. Explicit Forfeit / Leave Room
    const handleForfeit = (payload, callback) => {
      const mapping = socketToUser[socket.id];
      if (!mapping) {
        if (typeof callback === 'function') callback({ success: true });
        return;
      }
      const { roomCode, userId } = mapping;
      delete socketToUser[socket.id];

      const room = rooms[roomCode];
      if (!room) {
        if (typeof callback === 'function') callback({ success: true });
        return;
      }

      socket.leave(roomCode);
      socket.to(roomCode).emit('webrtc:peer-left', { leftUserId: userId });

      if (room.pauseTimeout && room.pausedPlayerId === userId) {
        clearTimeout(room.pauseTimeout);
        room.pauseTimeout = null;
        room.isPaused = false;
        room.pausedPlayerId = null;
        room.pauseExpiresAt = null;
      }

      if (room.gameState === 'PLAYING') {
        handleForfeitedPlayer(io, room, userId, true);
      } else {
        room.players = room.players.filter((p) => p.id !== userId);
      }

      if (room.players.length === 0) {
        if (room.turnTimer) clearTimeout(room.turnTimer);
        delete rooms[roomCode];
        if (typeof callback === 'function') callback({ success: true });
        return;
      }

      if (room.hostId === userId) {
        room.hostId = room.players[0].id;
        room.players[0].isReady = true;
      }

      broadcastRoomState(io, roomCode);
      if (typeof callback === 'function') callback({ success: true });
    };

    socket.on('room:forfeit', handleForfeit);
    socket.on('room:leave', handleForfeit);

    // 7. Socket Disconnect Handler
    socket.on('disconnect', () => {
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
            if (currentRoom.players.length === 0) {
              delete rooms[roomCode];
              return;
            }
            if (currentRoom.hostId === userId) {
              currentRoom.hostId = currentRoom.players[0].id;
              currentRoom.players[0].isReady = true;
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
