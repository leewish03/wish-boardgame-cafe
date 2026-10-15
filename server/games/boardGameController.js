import { resolveRoomAndUser, sessionError, sessionFailure } from '../shared/roomManager.js';
import { boardGameCores } from '../core/BoardGameService.js';

export function registerBoardGameController(io, service) {
  io.on('connection', socket => {
    for (const action of ['start', 'command', 'view-ready', 'presentation-ack']) {
      socket.on(`board:${action}`, async (payload, callback) => {
        try {
          const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
          if (!Object.hasOwn(boardGameCores, room.gameType)) throw sessionError(socket, payload, 'SESSION_CONTEXT_MISMATCH', roomCode, userId);
          let result = { success: true };
          if (action === 'start') result = await service.startMatch(roomCode, userId);
          else if (action === 'command') result = await service.handleCommand(roomCode, { ...payload?.command, playerId: userId, expectedVersion: payload?.expectedVersion });
          else if (action === 'presentation-ack') result = await service.acknowledgePresentation(roomCode, userId, payload?.eventId);
          else if (room.gameStateObject) socket.emit('room:state', service.projectRoomState(room, userId));
          if (typeof callback === 'function') callback(result);
        } catch (error) { if (typeof callback === 'function') callback(sessionFailure(error)); }
      });
    }
  });
}
