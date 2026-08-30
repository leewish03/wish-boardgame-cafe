// =========================================================================
// WebRTC Signaling Module - Relay Offer / Answer / ICE Candidates
// =========================================================================

import { socketToUser, rooms } from './roomManager.js';

export function initWebRTCSignaling(io) {
  io.on('connection', (socket) => {
    // Relay WebRTC Offer
    socket.on('webrtc:offer', ({ roomCode, targetUserId, fromUserId, offer }) => {
      const room = rooms[roomCode];
      if (!room) return;

      const targetPlayer = room.players.find((p) => p.id === targetUserId);
      if (targetPlayer && targetPlayer.socketId) {
        io.to(targetPlayer.socketId).emit('webrtc:offer', {
          fromUserId,
          offer,
        });
      }
    });

    // Relay WebRTC Answer
    socket.on('webrtc:answer', ({ roomCode, targetUserId, fromUserId, answer }) => {
      const room = rooms[roomCode];
      if (!room) return;

      const targetPlayer = room.players.find((p) => p.id === targetUserId);
      if (targetPlayer && targetPlayer.socketId) {
        io.to(targetPlayer.socketId).emit('webrtc:answer', {
          fromUserId,
          answer,
        });
      }
    });

    // Relay ICE Candidate
    socket.on('webrtc:ice-candidate', ({ roomCode, targetUserId, fromUserId, candidate }) => {
      const room = rooms[roomCode];
      if (!room) return;

      const targetPlayer = room.players.find((p) => p.id === targetUserId);
      if (targetPlayer && targetPlayer.socketId) {
        io.to(targetPlayer.socketId).emit('webrtc:ice-candidate', {
          fromUserId,
          candidate,
        });
      }
    });
  });
}
