// WebRTC signaling is deliberately a thin relay. Identity comes from the
// socket's current room membership, never from a client supplied fromUserId.
import { socketToUser, rooms } from './roomManager.js';

function resolveVoiceMember(socket, requestedRoomCode) {
  const mapping = socketToUser[socket.id];
  const roomCode = String(requestedRoomCode || mapping?.roomCode || '').toUpperCase().trim();
  if (!mapping || mapping.roomCode !== roomCode) return null;
  const room = rooms[roomCode];
  const player = room?.players.find((candidate) => candidate.id === mapping.userId);
  if (!room || !player || player.isBot || player.socketId !== socket.id) return null;
  return { roomCode, room, player };
}

function resolveTarget(room, targetUserId, actorId) {
  if (!targetUserId || targetUserId === actorId) return null;
  return room.players.find((candidate) => (
    candidate.id === targetUserId && !candidate.isBot && !candidate.isDisconnected && candidate.socketId
  )) || null;
}

function createRelay(io, socket, eventName, payloadKey) {
  return (payload = {}, callback) => {
    const source = resolveVoiceMember(socket, payload.roomCode);
    const target = source && resolveTarget(source.room, payload.targetUserId, source.player.id);
    if (!source || !target || !payload[payloadKey]) {
      if (typeof callback === 'function') callback({ success: false, error: '유효하지 않은 음성 연결 요청입니다.' });
      return;
    }
    io.to(target.socketId).emit(eventName, { fromUserId: source.player.id, [payloadKey]: payload[payloadKey] });
    if (typeof callback === 'function') callback({ success: true });
  };
}

export function initWebRTCSignaling(io) {
  io.on('connection', (socket) => {
    socket.on('voice:peers', (payload, callback) => {
      const source = resolveVoiceMember(socket, payload?.roomCode);
      if (!source) {
        if (typeof callback === 'function') callback({ success: false, error: '음성 방 참여 정보를 확인할 수 없습니다.' });
        return;
      }
      const peers = source.room.players
        .filter((player) => player.id !== source.player.id && !player.isBot && !player.isDisconnected && player.socketId)
        .map((player) => ({ userId: player.id, nickname: player.nickname, avatarUrl: player.avatarUrl || null }));
      if (typeof callback === 'function') callback({ success: true, peers });
    });

    socket.on('voice:presence', (payload, callback) => {
      const source = resolveVoiceMember(socket, payload?.roomCode);
      if (!source) {
        if (typeof callback === 'function') callback({ success: false, error: '음성 방 참여 정보를 확인할 수 없습니다.' });
        return;
      }
      socket.to(source.roomCode).emit('voice:presence', {
        userId: source.player.id,
        listening: !!payload?.listening,
        micEnabled: !!payload?.micEnabled,
        speaking: !!payload?.speaking,
      });
      if (typeof callback === 'function') callback({ success: true });
    });

    socket.on('webrtc:offer', createRelay(io, socket, 'webrtc:offer', 'offer'));
    socket.on('webrtc:answer', createRelay(io, socket, 'webrtc:answer', 'answer'));
    socket.on('webrtc:ice-candidate', createRelay(io, socket, 'webrtc:ice-candidate', 'candidate'));
  });
}
