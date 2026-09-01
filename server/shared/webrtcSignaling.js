// WebRTC signaling is deliberately a thin relay. Identity comes from the
// socket's current room membership, never from a client supplied fromUserId.
import { socketToUser, rooms } from './roomManager.js';

// Voice participation is deliberately separate from room membership.  Being
// seated in a room must not make a browser negotiate audio connections before
// the user explicitly chooses "listen".
const voiceMembersByRoom = new Map();

function roomVoiceMembers(roomCode) {
  if (!voiceMembersByRoom.has(roomCode)) voiceMembersByRoom.set(roomCode, new Set());
  return voiceMembersByRoom.get(roomCode);
}

function isVoiceMember(roomCode, userId) {
  return !!voiceMembersByRoom.get(roomCode)?.has(userId);
}

function leaveVoiceRoom(io, socket) {
  const mapping = socketToUser[socket.id];
  if (!mapping || !isVoiceMember(mapping.roomCode, mapping.userId)) return;
  const members = voiceMembersByRoom.get(mapping.roomCode);
  members.delete(mapping.userId);
  if (members.size === 0) voiceMembersByRoom.delete(mapping.roomCode);
  socket.to(mapping.roomCode).emit('voice:peer-left', { userId: mapping.userId });
}

function resolveVoiceMember(socket, requestedRoomCode) {
  const mapping = socketToUser[socket.id];
  const roomCode = String(requestedRoomCode || mapping?.roomCode || '').toUpperCase().trim();
  if (!mapping || mapping.roomCode !== roomCode) return null;
  const room = rooms[roomCode];
  const player = room?.players.find((candidate) => candidate.id === mapping.userId);
  if (!room || !player || player.isBot || player.socketId !== socket.id) return null;
  return { roomCode, room, player };
}

function resolveTarget(room, targetUserId, actorId, roomCode) {
  if (!targetUserId || targetUserId === actorId) return null;
  return room.players.find((candidate) => (
    candidate.id === targetUserId && !candidate.isBot && !candidate.isDisconnected && candidate.socketId && isVoiceMember(roomCode, candidate.id)
  )) || null;
}

function createRelay(io, socket, eventName, payloadKey) {
  return (payload = {}, callback) => {
    const source = resolveVoiceMember(socket, payload.roomCode);
    const target = source && resolveTarget(source.room, payload.targetUserId, source.player.id, source.roomCode);
    if (!source || !isVoiceMember(source.roomCode, source.player.id) || !target || !payload[payloadKey]) {
      if (typeof callback === 'function') callback({ success: false, error: '유효하지 않은 음성 연결 요청입니다.' });
      return;
    }
    io.to(target.socketId).emit(eventName, { fromUserId: source.player.id, [payloadKey]: payload[payloadKey] });
    if (typeof callback === 'function') callback({ success: true });
  };
}

export function initWebRTCSignaling(io) {
  io.on('connection', (socket) => {
    socket.on('voice:join', (payload, callback) => {
      const source = resolveVoiceMember(socket, payload?.roomCode);
      if (!source) {
        if (typeof callback === 'function') callback({ success: false, error: '음성 방 참여 정보를 확인할 수 없습니다.' });
        return;
      }
      const members = roomVoiceMembers(source.roomCode);
      const wasJoined = members.has(source.player.id);
      members.add(source.player.id);
      const peers = source.room.players
        .filter((player) => player.id !== source.player.id && !player.isBot && !player.isDisconnected && player.socketId && members.has(player.id))
        .map((player) => ({ userId: player.id, nickname: player.nickname, avatarUrl: player.avatarUrl || null }));
      if (!wasJoined) socket.to(source.roomCode).emit('voice:peer-joined', { userId: source.player.id });
      if (typeof callback === 'function') callback({ success: true, peers });
    });

    socket.on('voice:leave', (payload, callback) => {
      const source = resolveVoiceMember(socket, payload?.roomCode);
      if (source) leaveVoiceRoom(io, socket);
      if (typeof callback === 'function') callback({ success: !!source });
    });

    socket.on('voice:peers', (payload, callback) => {
      const source = resolveVoiceMember(socket, payload?.roomCode);
      if (!source || !isVoiceMember(source.roomCode, source.player.id)) {
        if (typeof callback === 'function') callback({ success: false, error: '음성 방 참여 정보를 확인할 수 없습니다.' });
        return;
      }
      const peers = source.room.players
        .filter((player) => player.id !== source.player.id && !player.isBot && !player.isDisconnected && player.socketId && isVoiceMember(source.roomCode, player.id))
        .map((player) => ({ userId: player.id, nickname: player.nickname, avatarUrl: player.avatarUrl || null }));
      if (typeof callback === 'function') callback({ success: true, peers });
    });

    socket.on('voice:presence', (payload, callback) => {
      const source = resolveVoiceMember(socket, payload?.roomCode);
      if (!source || !isVoiceMember(source.roomCode, source.player.id)) {
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
    socket.on('disconnect', () => leaveVoiceRoom(io, socket));
  });
}
