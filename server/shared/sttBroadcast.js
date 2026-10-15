// =========================================================================
// STT Broadcast Module - Relay Korean Speech-to-Text to Room Peers
// =========================================================================

import { resolveRoomAndUser, sessionFailure } from './roomManager.js';

export function initSTTBroadcast(io) {
  io.on('connection', (socket) => {
    socket.on('stt:transcript', (payload, callback) => {
      const reply = typeof callback === 'function' ? callback : () => {};
      try {
        const { roomCode, userId } = resolveRoomAndUser(socket, payload);
        if (typeof payload?.text !== 'string' || !payload.text.trim() || payload.text.length > 2000) {
          reply({ success: false, error: '자막 내용을 확인해 주세요.' });
          return;
        }
        io.to(roomCode).emit('stt:transcript', { userId, text: payload.text.trim(), timestamp: Date.now() });
        reply({ success: true });
      } catch (error) {
        reply(sessionFailure(error));
      }
    });
  });
}
