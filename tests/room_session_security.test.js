import assert from 'node:assert/strict';
import http from 'node:http';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { initRoomManager, rooms, socketToUser, configureGameLifecycle } from '../server/shared/roomManager.js';
import { registerLoveLetterController } from '../server/games/loveLetterController.js';
import { registerDalmutiController } from '../server/games/dalmutiController.js';
import { createRoomSessionBoundary, terminalSessionCode, normalizeSavedSession } from '../src/shared/roomSession.js';

const boundary = createRoomSessionBoundary();
assert.equal(normalizeSavedSession({ id: 'legacy-player', roomCode: 'OLD123' }).userId, 'legacy-player');
for (const cancel of ['leave', 'decline', 'timeout', 'unavailable']) {
  const request = boundary.begin('OLD123', 'alice');
  boundary.invalidate();
  assert.equal(boundary.accept(request, 'OLD123', 'alice'), false, cancel);
}
const oldRequest = boundary.begin('OLD123', 'alice');
const newRequest = boundary.begin('NEW123', 'bob');
assert.equal(boundary.isCurrent(oldRequest), false);
boundary.buffer({ code: 'NEW123', players: [{ id: 'bob' }] });
assert.equal(boundary.accept(newRequest, 'NEW123', 'bob'), true);
assert.equal(boundary.takeBuffered().code, 'NEW123');
assert.equal(boundary.matches({ roomCode: 'OLD123', userId: 'alice' }), false);
assert.equal(boundary.allows({ code: 'NEW123', players: [{ id: 'alice' }] }), false);
assert.equal(boundary.allows({ code: 'NEW123', players: [{ id: 'bob' }] }), true);
const nextRequest = boundary.begin('NEW123', 'bob');
boundary.accept(nextRequest, 'NEW123', 'bob');
assert.equal(boundary.matches({ roomCode: 'NEW123', userId: 'bob', requestId: newRequest.requestId }), false);
assert.equal(terminalSessionCode({ code: 'SESSION_NOT_BOUND', error: '방 없음' }), null);
assert.equal(terminalSessionCode({ error: '해당 방에 등록된 플레이어가 아닙니다.' }), 'PLAYER_REMOVED');

const server = http.createServer();
const io = new Server(server);
initRoomManager(io);
let snapshotCalls = 0;
registerLoveLetterController(io, { broadcastGameSnapshot() { snapshotCalls += 1; } });
registerDalmutiController(io, { projectRoomState(room, id) { snapshotCalls += 1; return { code: room.code, owner: id }; } });
await new Promise(resolve => server.listen(0, resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const clients = [];
const codes = [];
async function connect() {
  const client = ClientIO(url, { transports: ['websocket'] });
  clients.push(client);
  await new Promise(resolve => client.once('connect', resolve));
  return client;
}
function emit(client, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No response: ${event}`)), 3000);
    client.emit(event, payload, result => { clearTimeout(timer); resolve(result); });
  });
}
try {
  for (const gameType of ['LOVE_LETTER', 'DALMUTI']) {
    const owner = await connect();
    const attacker = await connect();
    const created = await emit(owner, 'room:create', { gameType, nickname: 'Owner' });
    assert.equal(created.success, true);
    codes.push(created.roomCode);
    const payload = { roomCode: created.roomCode, userId: created.userId };
    const viewEvent = gameType === 'LOVE_LETTER' ? 'game:view-ready' : 'dalmuti:view-ready';
    const player = rooms[created.roomCode].players.find(p => p.id === created.userId);
    const originalSocket = player.socketId;
    const beforeCalls = snapshotCalls;
    assert.equal((await emit(attacker, viewEvent, payload)).code, 'SESSION_NOT_BOUND');
    for (const event of ['room:reconnect', 'session:heartbeat', ...(gameType === 'LOVE_LETTER' ? ['game:sync-request'] : [])]) {
      for (const sessionToken of [undefined, 'wrong-token']) {
        assert.equal((await emit(attacker, event, { ...payload, sessionToken })).code, 'SESSION_INVALID');
        assert.equal(player.socketId, originalSocket);
        assert.equal(socketToUser[originalSocket].userId, created.userId);
        assert.equal(socketToUser[attacker.id], undefined);
      }
    }
    assert.equal(snapshotCalls, beforeCalls, 'unauthorized requests must not produce snapshots');
    assert.equal((await emit(owner, viewEvent, payload)).success, true);
    assert.equal((await emit(owner, viewEvent, { ...payload, userId: 'another-player' })).code, 'SESSION_CONTEXT_MISMATCH');
    const recovered = await emit(attacker, 'room:reconnect', { ...payload, sessionToken: created.sessionToken });
    assert.equal(recovered.success, true);
    assert.equal(player.socketId, attacker.id);
    assert.equal(io.sockets.sockets.get(originalSocket).rooms.has(created.roomCode), false);
    assert.equal((await emit(owner, viewEvent, payload)).code, 'SESSION_NOT_BOUND');
    player.takenOverByBot = true;
    const notice = new Promise(resolve => attacker.once('room:unavailable', resolve));
    assert.equal((await emit(attacker, 'session:heartbeat', { ...payload, sessionToken: created.sessionToken })).code, 'SEAT_TAKEN_OVER');
    assert.equal((await notice).code, 'SEAT_TAKEN_OVER');
    assert.equal(socketToUser[attacker.id], undefined, 'terminal failure must release the obsolete subscription');
    player.takenOverByBot = false;
    assert.equal((await emit(attacker, 'session:heartbeat', { ...payload, sessionToken: created.sessionToken })).success, true);
    rooms[created.roomCode].players = [];
    assert.equal((await emit(attacker, viewEvent, payload)).code, 'PLAYER_REMOVED');
    assert.equal((await emit(attacker, 'room:reconnect', { ...payload, sessionToken: created.sessionToken })).code, 'PLAYER_REMOVED');
    delete rooms[created.roomCode];
    assert.equal((await emit(attacker, 'session:heartbeat', { ...payload, sessionToken: created.sessionToken })).code, 'ROOM_NOT_FOUND');
  }

  // Hold the resume promise while an explicit departure invalidates the binding.
  const owner = await connect();
  const reconnecting = await connect();
  const created = await emit(owner, 'room:create', { gameType: 'LOVE_LETTER', nickname: 'Race' });
  codes.push(created.roomCode);
  const room = rooms[created.roomCode];
  room.gameStateObject = { matchState: 'LOBBY' };
  room.isPaused = true;
  room.pausedPlayerId = created.userId;
  let release;
  let entered;
  const resumeEntered = new Promise(resolve => { entered = resolve; });
  configureGameLifecycle('LOVE_LETTER', { resume: async () => {
    entered();
    await new Promise(resolve => { release = resolve; });
  } });
  const payload = { roomCode: created.roomCode, userId: created.userId, sessionToken: created.sessionToken };
  const pending = emit(reconnecting, 'room:reconnect', payload);
  await resumeEntered;
  assert.equal((await emit(reconnecting, 'room:leave', payload)).success, true);
  release();
  assert.equal((await pending).success, false, 'a late resume must not acknowledge a departed session');
  console.log('Room session security: authentication, terminal exits, stale replies and reconnect races passed.');
} finally {
  codes.forEach(code => { delete rooms[code]; });
  clients.forEach(client => client.disconnect());
  await new Promise(resolve => io.close(resolve));
}
