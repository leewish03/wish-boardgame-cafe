import { rooms, resolveRoomAndUser, socketToUser } from '../shared/roomManager.js';

const fail = (callback, error) => { if (typeof callback === 'function') callback({ success: false, error: error.message || String(error) }); };

export function registerDalmutiController(io, service) {
  io.on('connection', (socket) => {
    socket.on('dalmuti:view-ready', (payload, callback) => {
      const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
      if (!room || room.gameType !== 'DALMUTI') {
        const error = '달무티 방을 찾을 수 없습니다.';
        socket.emit('room:unavailable', { roomCode: roomCode || payload?.roomCode || null, error });
        callback?.({ success: false, error });
        return;
      }
      socket.emit('room:state', service.projectRoomState(room, userId));
      callback?.({ success: true });
    });

    socket.on('dalmuti:presentation-ack', async (payload, callback) => {
      try {
        const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (!room || room.gameType !== 'DALMUTI') {
          const error = new Error('달무티 방을 찾을 수 없습니다.');
          socket.emit('room:unavailable', { roomCode: roomCode || payload?.roomCode || null, error: error.message });
          throw error;
        }
        callback?.(await service.acknowledgePresentation(roomCode, userId, payload?.eventId));
      } catch (error) { fail(callback, error); }
    });

    socket.on('dalmuti:start', async (payload, callback) => {
      try {
        const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (!room || room.gameType !== 'DALMUTI') {
          const error = new Error('달무티 방을 찾을 수 없습니다.');
          socket.emit('room:unavailable', { roomCode: roomCode || payload?.roomCode || null, error: error.message });
          throw error;
        }
        const result = await service.startMatch(roomCode, userId);
        callback?.(result);
      } catch (error) { fail(callback, error); }
    });

    socket.on('dalmuti:command', async (payload, callback) => {
      try {
        const { room, roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (!room || room.gameType !== 'DALMUTI') {
          const error = new Error('달무티 방을 찾을 수 없습니다.');
          socket.emit('room:unavailable', { roomCode: roomCode || payload?.roomCode || null, error: error.message });
          throw error;
        }
        const command = { ...(payload?.command || {}), playerId: userId };
        const allowed = new Set(['DECLARE_REVOLUTION','DECLINE_REVOLUTION','SELECT_TAX_RETURN','SELECT_MERCHANT_EXCHANGE_TARGET','PLAY_SET','PASS','ADVANCE_ROUND']);
        if (!allowed.has(command.type)) throw new Error('허용되지 않는 달무티 명령입니다.');
        if (command.type === 'ADVANCE_ROUND' && room.hostId !== userId) throw new Error('방장만 다음 라운드를 바로 시작할 수 있습니다.');
        const result = await service.handleCommand(roomCode, command);
        callback?.(result);
      } catch (error) { fail(callback, error); }
    });
  });
}
