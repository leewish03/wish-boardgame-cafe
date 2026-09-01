import assert from 'assert';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { initRoomManager, rooms, socketToUser } from '../server/shared/roomManager.js';
import { initWebRTCSignaling } from '../server/shared/webrtcSignaling.js';

function once(socket, event, timeout = 3_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function emit(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

async function main() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  initRoomManager(io);
  initWebRTCSignaling(io);
  await new Promise((resolve) => server.listen(0, resolve));

  const url = `http://127.0.0.1:${server.address().port}`;
  const a = ClientIO(url, { transports: ['websocket'] });
  const b = ClientIO(url, { transports: ['websocket'] });
  let returningA = null;
  let roomCode = null;

  try {
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);
    const created = await emit(a, 'room:create', { gameType: 'LOVE_LETTER', nickname: 'Alice' });
    roomCode = created.roomCode;
    const joined = await emit(b, 'room:join', { roomCode, nickname: 'Bob' });
    assert.equal(created.success, true);
    assert.equal(joined.success, true);

    assert.deepEqual(await emit(a, 'voice:join', { roomCode }), { success: true, peers: [] });
    const joinedNotice = once(a, 'voice:peer-joined');
    const voiceB = await emit(b, 'voice:join', { roomCode });
    assert.equal(voiceB.success, true);
    assert.deepEqual(voiceB.peers.map((peer) => peer.userId), [created.userId]);
    assert.equal((await joinedNotice).userId, joined.userId);

    // A fresh Socket.IO transport can temporarily lose only its lightweight
    // mapping. The authenticated heartbeat must restore it before voice joins.
    delete socketToUser[a.id];
    assert.equal((await emit(a, 'voice:peers', { roomCode })).success, false);
    const healed = await emit(a, 'session:heartbeat', {
      roomCode,
      userId: created.userId,
      sessionToken: created.sessionToken,
    });
    assert.equal(healed.success, true, 'authenticated heartbeat must restore the room/socket mapping');
    assert.equal((await emit(a, 'voice:peers', { roomCode })).success, true);

    const leftNotice = once(b, 'voice:peer-left');
    a.disconnect();
    assert.equal((await leftNotice).userId, created.userId, 'disconnect must remove the old voice member before room mapping is deleted');

    returningA = ClientIO(url, { transports: ['websocket'] });
    await once(returningA, 'connect');
    const beforeRoomMapping = await emit(returningA, 'voice:join', { roomCode });
    assert.equal(beforeRoomMapping.success, false, 'voice join must reject until the verified room reconnect completes');
    const reconnected = await emit(returningA, 'room:reconnect', {
      roomCode,
      userId: created.userId,
      sessionToken: created.sessionToken,
    });
    assert.equal(reconnected.success, true, reconnected.error);

    const rejoinNotice = once(b, 'voice:peer-joined');
    const voiceRejoin = await emit(returningA, 'voice:join', { roomCode });
    assert.equal(voiceRejoin.success, true);
    assert.deepEqual(voiceRejoin.peers.map((peer) => peer.userId), [joined.userId]);
    assert.equal((await rejoinNotice).userId, created.userId, 'a reconnected listener must be announced to existing peers');
    console.log('✅ Voice signalling: join, disconnect cleanup, verified reconnect, and peer rejoin all passed.');
  } finally {
    if (roomCode) delete rooms[roomCode];
    a.disconnect();
    b.disconnect();
    returningA?.disconnect();
    io.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
