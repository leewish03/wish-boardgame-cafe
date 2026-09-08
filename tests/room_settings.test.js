import assert from 'assert';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { initRoomManager, rooms } from '../server/shared/roomManager.js';

function once(socket, event, timeout = 3_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, payload => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

console.log('🧪 Starting room setting persistence test...');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
initRoomManager(io);

server.listen(0, async () => {
  const client = ClientIO(`http://localhost:${server.address().port}`, { transports: ['websocket'] });
  try {
    await once(client, 'connect');
    const created = await new Promise(resolve => client.emit('room:create', {
      gameType: 'LOVE_LETTER',
      nickname: '무제한 방장',
      turnTimeLimit: 0,
    }, resolve));

    assert.equal(created.success, true, 'room creation should succeed');
    assert.equal(rooms[created.roomCode].turnTimeLimit, 0, 'untimed tables must preserve zero on the authoritative room');
    console.log('✅ Untimed room setting stays at 0 seconds.');
  } finally {
    client.close();
    await new Promise(resolve => io.close(resolve));
    await new Promise(resolve => server.close(resolve));
  }
});
