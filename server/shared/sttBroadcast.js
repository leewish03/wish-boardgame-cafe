// =========================================================================
// STT Broadcast Module - Relay Korean Speech-to-Text to Room Peers
// =========================================================================

import { rooms } from './roomManager.js';

export function initSTTBroadcast(io) {
  io.on('connection', (socket) => {
    socket.on('stt:transcript', ({ roomCode, userId, text, timestamp }) => {
      const room = rooms[roomCode];
      if (!room || !text?.trim()) return;

      // Broadcast transcript to everyone in the room
      io.to(roomCode).emit('stt:transcript', {
        userId,
        text: text.trim(),
        timestamp: timestamp || Date.now(),
      });
    });
  });
}
