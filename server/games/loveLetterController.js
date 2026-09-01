import { SOCKET_EVENTS } from '../core/LoveLetterService.js';
import { rooms, resolveRoomAndUser, socketToUser } from '../shared/roomManager.js';

function callbackError(callback, error) {
  if (typeof callback === 'function') callback({ success: false, error: error.message || String(error) });
}

function normalizeCommand(payload, playerId) {
  const command = payload?.command || payload;
  if (!command || typeof command.type !== 'string') {
    throw new Error('게임 명령 형식이 올바르지 않습니다.');
  }

  switch (command.type) {
    case 'PLAY_CARD':
      return {
        type: 'PLAY_CARD',
        playerId,
        cardId: command.cardId,
        targetId: command.targetId,
        guessValue: command.guessValue,
      };
    case 'FORFEIT':
      return { type: 'FORFEIT', playerId };
    default:
      throw new Error('클라이언트에서 허용되지 않는 게임 명령입니다.');
  }
}

export function registerLoveLetterController(io, service) {
  io.on('connection', (socket) => {
    const handleStart = async (payload, callback) => {
      try {
        const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (!room || !roomCode || !userId) throw new Error('방 또는 플레이어를 찾을 수 없습니다.');
        await service.startMatch(roomCode, userId);
        if (typeof callback === 'function') callback({ success: true });
      } catch (error) {
        callbackError(callback, error);
      }
    };

    socket.on('game:start', handleStart);
    socket.on('loveletter:start-game', handleStart);

    socket.on('game:advance', async (payload, callback) => {
      try {
        const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (!room || !roomCode || !userId) throw new Error('방 또는 플레이어를 찾을 수 없습니다.');
        const result = await service.advanceRound(roomCode, userId, payload?.expectedStateVersion, payload?.requestId);
        if (typeof callback === 'function') callback({ success: true, ...result });
      } catch (error) {
        callbackError(callback, error);
      }
    });

    socket.on('game:rematch', async (payload, callback) => {
      try {
        const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (!room || !roomCode || !userId) throw new Error('방 또는 플레이어를 찾을 수 없습니다.');
        const result = await service.startRematch(roomCode, userId, payload?.expectedStateVersion, payload?.requestId);
        if (typeof callback === 'function') callback({ success: true, ...result });
      } catch (error) {
        callbackError(callback, error);
      }
    });

    socket.on(SOCKET_EVENTS.GAME_COMMAND, async (payload, callback) => {
      try {
        const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (!room || !roomCode || !userId) throw new Error('방 또는 플레이어를 찾을 수 없습니다.');
        const command = normalizeCommand(payload, userId);
        await service.handleCommand(roomCode, command);
        if (typeof callback === 'function') callback({ success: true });
      } catch (error) {
        callbackError(callback, error);
      }
    });

    socket.on(SOCKET_EVENTS.SYNC_REQUEST, (payload, callback) => {
      try {
        const code = String(payload?.roomCode || '').toUpperCase().trim();
        const playerId = payload?.playerId || payload?.userId;
        const room = rooms[code];
        const player = room?.players.find((candidate) => candidate.id === playerId);
        if (!room || !player || !payload?.sessionToken || player.sessionToken !== payload.sessionToken) {
          throw new Error('재접속 세션을 확인할 수 없습니다.');
        }
        player.socketId = socket.id;
        player.isDisconnected = false;
        player.disconnectedAt = null;
        socketToUser[socket.id] = { roomCode: code, userId: player.id };
        socket.join(code);
        service.broadcastGameSnapshot(code, room);
        if (typeof callback === 'function') callback({ success: true, stateVersion: room.stateVersion });
      } catch (error) {
        callbackError(callback, error);
      }
    });
  });
}
