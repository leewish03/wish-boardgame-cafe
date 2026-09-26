import { SOCKET_EVENTS } from '../core/LoveLetterService.js';
import { resolveRoomAndUser, sessionError, sessionFailure, authenticateRoomSession, bindRoomSession, isRoomSessionCurrent } from '../shared/roomManager.js';

function callbackError(callback, error) {
  if (typeof callback === 'function') callback(sessionFailure(error));
}

function requireLoveLetterRoom(socket, payload) {
  const resolved = resolveRoomAndUser(socket, payload);
  const { room, roomCode, userId } = resolved;
  if (room.gameType !== 'LOVE_LETTER') {
    throw sessionError(socket, payload, 'SESSION_CONTEXT_MISMATCH', roomCode, userId);
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
        const session = authenticateRoomSession(socket, payload);
        const { room, roomCode: code, player } = session;
        if (room.gameType !== 'LOVE_LETTER') throw sessionError(socket, payload, 'SESSION_CONTEXT_MISMATCH', code, player.id);
        bindRoomSession(socket, session);
        // A sync request can be the first message after Socket.IO restored a
        // transport.  Treat it as a verified reconnection, not merely a
        // snapshot request; otherwise a paused table can remain frozen until
        // the heartbeat notices an unrelated state mismatch.
        if (room.isPaused && (room.pausedPlayerId === player.id || !room.players.some((member) => member.isDisconnected))) {
          await service.resumeRoom(code);
        }
        if (!isRoomSessionCurrent(socket, session)) throw sessionError(socket, payload, 'SESSION_NOT_BOUND', code, player.id);
        service.broadcastGameSnapshot(code, room);
        if (typeof callback === 'function') callback({ success: true, stateVersion: room.stateVersion });
      } catch (error) {
        callbackError(callback, error);
      }
    });
  });
}

