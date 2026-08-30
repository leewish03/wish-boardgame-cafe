// =========================================================================
// Room Manager Module - In-Memory Room & Player State Management
// =========================================================================

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
        const avatar =
          avatarUrl ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(nickname || userId)}`;

        const player = {
          id: userId,
          socketId: socket.id,
          nickname,
          avatarUrl: avatar,
          isReady: true, // Host is ready by default
          tokens: 0,
          isEliminated: false,
          isProtected: false,
          hand: [],
          discardPile: [],
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
        };

        rooms[roomCode] = newRoom;
        socketToUser[socket.id] = { roomCode, userId };
        socket.join(roomCode);

        if (typeof callback === 'function') {
          callback({ success: true, roomCode, userId, player });
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
        const avatar =
          avatarUrl ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(nickname || userId)}`;

        const player = {
          id: userId,
          socketId: socket.id,
          nickname,
          avatarUrl: avatar,
          isReady: false,
          tokens: 0,
          isEliminated: false,
          isProtected: false,
          hand: [],
          discardPile: [],
        };

        room.players.push(player);
        socketToUser[socket.id] = { roomCode: code, userId };
        socket.join(code);

        // Notify WebRTC peer join
        socket.to(code).emit('webrtc:peer-joined', { newUserId: userId });

        if (typeof callback === 'function') {
          callback({ success: true, roomCode: code, userId, player });
        }

        broadcastRoomState(io, code);
      } catch (err) {
        console.error('room:join error:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: '방 입장 중 오류가 발생했습니다.' });
        }
      }
    });

    // 3. Ready Toggle
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

    // 4. Chat Message
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

    // 5. Leave Room / Disconnect
    const handleLeave = () => {
      const mapping = socketToUser[socket.id];
      if (!mapping) return;
      const { roomCode, userId } = mapping;
      delete socketToUser[socket.id];

      const room = rooms[roomCode];
      if (!room) return;

      socket.leave(roomCode);
      socket.to(roomCode).emit('webrtc:peer-left', { leftUserId: userId });

      room.players = room.players.filter((p) => p.id !== userId);

      if (room.players.length === 0) {
        if (room.turnTimer) clearTimeout(room.turnTimer);
        delete rooms[roomCode];
        return;
      }

      // If host left, migrate host to the next player
      if (room.hostId === userId) {
        room.hostId = room.players[0].id;
        room.players[0].isReady = true;
      }

      broadcastRoomState(io, roomCode);
    };

    socket.on('room:leave', handleLeave);
    socket.on('disconnect', handleLeave);
  });
}
