import assert from 'node:assert/strict';
import http from 'node:http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { initRoomManager, rooms, socketToUser, broadcastRoomState, configureCoreGameLifecycle } from '../server/shared/roomManager.js';
import { createLoveLetterService } from '../server/core/LoveLetterService.js';
import { registerLoveLetterController } from '../server/games/loveLetterController.js';
import { createRoomOperationGuard } from '../src/shared/roomSession.js';

const server = http.createServer();
const io = new Server(server);
initRoomManager(io);
const service = createLoveLetterService(io, { broadcastRoomState });
configureCoreGameLifecycle({ resume: code => service.resumeRoom(code) });
registerLoveLetterController(io, service);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const clients = [];
const failures = [];
const emit = (client, event, payload = {}) => new Promise((resolve, reject) => {
  client.timeout(800).emit(event, payload, (error, result) => error ? reject(new Error(`ACK timeout: ${event}`)) : resolve(result));
});
async function connect() {
  const client = Client(`http://127.0.0.1:${server.address().port}`, { transports: ['websocket'], reconnection: false });
  clients.push(client);
  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
  });
  return client;
}
async function scenario(name, run) {
  try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.stack}`); }
}
try {
  await scenario('client guard bounds ACKs and never replays offline commands', async () => {
    const client = await connect();
    const serverSocket = io.sockets.sockets.get(client.id);
    let commands = 0;
    serverSocket.on('test:delayed-room-command', (_payload, ack) => {
      commands += 1;
      setTimeout(() => ack({ success: true }), 100);
    });
    const states = [], results = [];
    const guard = createRoomOperationGuard(value => states.push(value));
    const first = new Promise(resolve => {
      assert.equal(guard.run(client, 'join', 'test:delayed-room-command', {}, result => { results.push(result); resolve(result); }, 40), true);
      assert.equal(guard.run(client, 'join', 'test:delayed-room-command', {}, () => assert.fail('duplicate callback')), false);
    });
    assert.equal((await first).success, false, 'missing ACK must unlock with an actionable failure');
    await new Promise(resolve => setTimeout(resolve, 110));
    assert.equal(commands, 1);
    assert.equal(results.length, 1, 'late ACK must not complete an expired operation');
    assert.deepEqual(states, ['join', null]);
    const interrupted = new Promise(resolve => guard.run(client, 'ready', 'test:delayed-room-command', {}, resolve, 200));
    client.disconnect();
    assert.equal((await interrupted).success, false);
    assert.equal(guard.isPending(), false);
    const buffered = client.sendBuffer.length;
    let offline;
    assert.equal(guard.run(client, 'create', 'test:delayed-room-command', {}, result => { offline = result; }), false);
    assert.equal(offline.success, false);
    assert.equal(client.sendBuffer.length, buffered, 'offline intent must not enter Socket.IO replay buffer');
    const reconnect = new Promise(resolve => client.once('connect', resolve));
    client.connect(); await reconnect;
    assert.equal(client.sendBuffer.length, 0);
    const canceled = [];
    const newServerSocket = io.sockets.sockets.get(client.id);
    newServerSocket.on('test:delayed-room-command', (_payload, ack) => setTimeout(() => ack({ success: true }), 40));
    guard.run(client, 'profile', 'test:delayed-room-command', {}, result => canceled.push(result));
    guard.cancel();
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(canceled.length, 0, 'departure must invalidate late callbacks');
  });
  await scenario('duplicate create returns one authenticated seat', async () => {
    const client = await connect();
    const payload = { nickname: 'Host', requestId: 'create-duplicate', turnTimeLimit: 0 };
    const [first, second] = await Promise.all([emit(client, 'room:create', payload), emit(client, 'room:create', payload)]);
    assert.equal(second.roomCode, first.roomCode, 'same create intent must not allocate another room');
    assert.equal(second.userId, first.userId);
    assert.equal(second.sessionToken, first.sessionToken);
    assert.equal(rooms[first.roomCode].players.length, 1);
    assert.equal(socketToUser[client.id].userId, first.userId);
    const outsider = await connect();
    const other = await emit(outsider, 'room:create', payload);
    assert.notEqual(other.roomCode, first.roomCode, 'request ID alone must not reveal another identity');
    assert.equal((await emit(client, 'room:leave', { roomCode: first.roomCode })).success, true);
    const fresh = await emit(client, 'room:create', { ...payload, requestId: 'create-new' });
    assert.notEqual(fresh.roomCode, first.roomCode, 'explicit leave permits a fresh room');
  });
  await scenario('duplicate join and ready preserve one seat and desired state', async () => {
    const owner = await connect(), guest = await connect();
    const created = await emit(owner, 'room:create', { nickname: 'Host', maxPlayers: 2, turnTimeLimit: 0 });
    const payload = { roomCode: created.roomCode, nickname: 'Guest', requestId: 'join-duplicate' };
    const guestSocket = io.sockets.sockets.get(guest.id);
    const joinHandler = guestSocket.listeners('room:join')[0];
    guestSocket.removeListener('room:join', joinHandler);
    guestSocket.on('room:join', (request, acknowledge) => {
      joinHandler(request, result => setTimeout(() => acknowledge(result), 40));
    });
    const [first, second] = await Promise.all([emit(guest, 'room:join', payload), emit(guest, 'room:join', payload)]);
    assert.equal(second.success, true, 'duplicate join must acknowledge even when original fills room');
    assert.equal(second.userId, first.userId);
    assert.equal(rooms[created.roomCode].players.length, 2);
    const ready = { roomCode: created.roomCode, userId: first.userId, isReady: true };
    const replies = await Promise.all([emit(guest, 'room:ready', ready), emit(guest, 'room:ready', ready)]);
    assert.ok(replies.every(result => result.success && result.isReady));
    assert.equal(rooms[created.roomCode].players.find(player => player.id === first.userId).isReady, true);
    assert.equal((await emit(guest, 'room:ready', { ...ready, isReady: 'false' })).success, false, 'nonboolean desired state must reject');
  });
  await scenario('authenticated canonical profile survives chat start and reconnect', async () => {
    const owner = await connect(), guest = await connect(), attacker = await connect();
    const created = await emit(owner, 'room:create', { nickname: 'Host', turnTimeLimit: 0 });
    const joined = await emit(guest, 'room:join', { roomCode: created.roomCode, nickname: 'Before' });
    const session = { roomCode: created.roomCode, userId: joined.userId, sessionToken: joined.sessionToken };
    const oldMessage = await emit(guest, 'chat:message', { ...session, text: 'before rename' });
    const roster = new Promise(resolve => owner.once('room:state', resolve));
    const renamed = await emit(guest, 'room:profile', { ...session, nickname: '  After  ', avatarUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=after', isHost: true });
    assert.equal(renamed.success, true);
    assert.equal(renamed.player.nickname, 'After');
    const state = await roster;
    const player = state.players.find(value => value.id === joined.userId);
    assert.equal(player.nickname, 'After');
    assert.equal(player.isHost, false);
    assert.equal(player.sessionToken, undefined);
    assert.equal((await emit(attacker, 'room:profile', { ...session, nickname: 'Forged' })).success, false);
    assert.equal((await emit(owner, 'room:profile', { ...session, nickname: 'Forged' })).success, false);
    assert.equal((await emit(guest, 'room:profile', { ...session, nickname: '' })).success, false);
    assert.equal((await emit(guest, 'room:profile', { ...session, nickname: 'After', avatarUrl: 'javascript:bad' })).success, false);
    const newMessage = await emit(guest, 'chat:message', { ...session, text: 'after rename' });
    assert.equal(newMessage.message.nickname, 'After');
    assert.equal(rooms[created.roomCode].chatMessages.find(value => value.id === oldMessage.message.id).nickname, 'Before');
    assert.equal(rooms[created.roomCode].players.find(value => value.id === joined.userId).sessionToken, joined.sessionToken);
    await emit(guest, 'room:ready', { ...session, isReady: true });
    assert.equal((await emit(owner, 'game:start', {})).success, true);
    assert.equal(rooms[created.roomCode].gameStateObject.players.find(value => value.id === joined.userId).nickname, 'After');
    assert.equal((await emit(guest, 'room:profile', { ...session, nickname: 'DuringGame' })).success, false);
    const replacement = await connect();
    const recovered = await emit(replacement, 'room:reconnect', session);
    assert.equal(recovered.success, true);
    assert.equal(recovered.player.nickname, 'After');
    assert.equal(recovered.gameState.players.find(value => value.id === joined.userId).nickname, 'After');
    assert.equal(recovered.userId, joined.userId);
  });
} finally {
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    clearTimeout(room.turnTimer); clearTimeout(room.pauseTimeout);
    delete rooms[code];
  }
  clients.forEach(client => client.disconnect());
  await new Promise(resolve => io.close(resolve));
}
if (failures.length) process.exitCode = 1;
