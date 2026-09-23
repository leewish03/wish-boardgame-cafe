import { SOCKET_EVENTS } from '../core/LoveLetterService.js';
import { rooms, resolveRoomAndUser, socketToUser } from '../shared/roomManager.js';

function callbackError(callback, error) {
  if (typeof callback === 'function') callback({ success: false, error: error.message || String(error) });
}

function emitRoomUnavailable(socket, payload, error) {
  const roomCode = String(payload?.roomCode || '').toUpperCase().trim() || null;
  socket.emit('room:unavailable', {
    roomCode,
    error: error.message || String(error),
  });
}

function requireLoveLetterRoom(socket, payload) {
  const resolved = resolveRoomAndUser(socket, payload);
  const { room, roomCode, userId } = resolved;
  if (!room || !roomCode || !userId || room.gameType !== 'LOVE_LETTER' || !room.players.some((player) => player.id === userId)) {
    const error = new Error('러브레터 방을 찾을 수 없습니다.');
    emitRoomUnavailable(socket, { ...payload, roomCode }, error);
    throw error;
  }
  return resolved;
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
    // The table mounts after the lobby receives room:state. Its first snapshot
    // may already have been emitted, so let the authenticated socket request it.
    socket.on(SOCKET_EVENTS.GAME_VIEW_READY, (payload, callback) => {
      try {
        const { room, roomCode } = requireLoveLetterRoom(socket, payload);
        service.broadcastGameSnapshot(roomCode, room);
        if (typeof callback === 'function') callback({ success: true });
      } catch (error) {
        callbackError(callback, error);
      }
    });
    const handleStart = async (payload, callback) => {
      try {
        const { roomCode, userId } = requireLoveLetterRoom(socket, payload);
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
        const { roomCode, userId } = requireLoveLetterRoom(socket, payload);
        const result = await service.advanceRound(roomCode, userId, payload?.expectedStateVersion, payload?.requestId);
        if (typeof callback === 'function') callback({ success: true, ...result });
      } catch (error) {
        callbackError(callback, error);
      }
    });

    socket.on('game:rematch', async (payload, callback) => {
      try {
        const { roomCode, userId } = requireLoveLetterRoom(socket, payload);
        const result = await service.startRematch(roomCode, userId, payload?.expectedStateVersion, payload?.requestId);
        if (typeof callback === 'function') callback({ success: true, ...result });
      } catch (error) {
        callbackError(callback, error);
      }
    });

    socket.on(SOCKET_EVENTS.GAME_COMMAND, async (payload, callback) => {
      try {
        const { roomCode, userId } = requireLoveLetterRoom(socket, payload);
        const command = normalizeCommand(payload, userId);
        await service.handleCommand(roomCode, command);
        if (typeof callback === 'function') callback({ success: true });
      } catch (error) {
        callbackError(callback, error);
      }
    });

    socket.on(SOCKET_EVENTS.GAME_PRESENTATION_ACK, async (payload, callback) => {
      try {
        const { roomCode, userId } = requireLoveLetterRoom(socket, payload);
        const result = await service.acknowledgePresentation(
          roomCode,
          userId,
          payload?.actionId,
          payload?.expectedStateVersion,
          payload?.completedPhase,
          payload?.roundNumber,
        );
        if (typeof callback === 'function') callback(result);
      } catch (error) {
        callbackError(callback, error);
      }
    });

    socket.on(SOCKET_EVENTS.SYNC_REQUEST, async (payload, callback) => {
      try {
        const code = String(payload?.roomCode || '').toUpperCase().trim();
        const playerId = payload?.playerId || payload?.userId;
        const room = rooms[code];
        const player = room?.players.find((candidate) => candidate.id === playerId);
        if (!room || !player) {
          const error = new Error('러브레터 방을 찾을 수 없습니다.');
          emitRoomUnavailable(socket, payload, error);
          throw error;
        }
        if (!payload?.sessionToken || player.sessionToken !== payload.sessionToken) {
          throw new Error('재접속 세션을 확인할 수 없습니다.');
        }
        player.socketId = socket.id;
        player.isDisconnected = false;
        player.disconnectedAt = null;
        socketToUser[socket.id] = { roomCode: code, userId: player.id };
        socket.join(code);
        // A sync request can be the first message after Socket.IO restored a
        // transport.  Treat it as a verified reconnection, not merely a
        // snapshot request; otherwise a paused table can remain frozen until
        // the heartbeat notices an unrelated state mismatch.
        if (room.isPaused && (room.pausedPlayerId === player.id || !room.players.some((member) => member.isDisconnected))) {
          await service.resumeRoom(code);
        }
        service.broadcastGameSnapshot(code, room);
        if (typeof callback === 'function') callback({ success: true, stateVersion: room.stateVersion });
      } catch (error) {
        callbackError(callback, error);
      }
    });
  });
}

