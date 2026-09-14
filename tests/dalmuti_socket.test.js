import http from 'node:http';
import assert from 'node:assert/strict';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { initRoomManager, configureGameLifecycle, rooms } from '../server/shared/roomManager.js';
import { createDalmutiService } from '../server/core/DalmutiService.js';
import { registerDalmutiController } from '../server/games/dalmutiController.js';
import { chooseBotCommand } from '../packages/dalmuti-core/src/index.js';

const waitFor = (client, event, timeout = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
  client.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
});
const waitForMatching = (client, event, predicate, timeout = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { client.off(event, listener); reject(new Error(`Timed out waiting for matching ${event}`)); }, timeout);
  const listener = (payload) => {
    if (!predicate(payload)) return;
    clearTimeout(timer); client.off(event, listener); resolve(payload);
  };
  client.on(event, listener);
});
const emit = (client, event, payload) => new Promise((resolve) => client.emit(event, payload, resolve));

const server = http.createServer();
const io = new Server(server, { cors: { origin: '*' } });
initRoomManager(io);
const service = createDalmutiService(io);
configureGameLifecycle('DALMUTI', {
  pause: (code, id) => service.pauseRoom(code, id),
  resume: (code) => service.resumeRoom(code),
  disconnectExpired: (code, id) => service.disconnectExpired(code, id),
  projectPublicState: (room, id) => service.projectRoomState(room, id),
});
registerDalmutiController(io, service);
await new Promise((resolve) => server.listen(0, resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const clients = Array.from({ length: 4 }, () => ClientIO(url, { transports: ['websocket'] }));

try {
  await Promise.all(clients.map((client) => waitFor(client, 'connect')));
  const created = await emit(clients[0], 'room:create', { gameType:'DALMUTI', nickname:'Host', maxPlayers:4, roundCount:5, turnTimeLimit:0 });
  assert.ok(created.success);
  const ids = [created.userId];
  const credentials = [{ userId:created.userId, sessionToken:created.sessionToken }];
  for (let index = 1; index < clients.length; index += 1) {
    const joined = await emit(clients[index], 'room:join', { roomCode:created.roomCode, nickname:`P${index}` });
    assert.ok(joined.success); ids.push(joined.userId); credentials.push({ userId:joined.userId, sessionToken:joined.sessionToken });
    assert.ok((await emit(clients[index], 'room:ready', { roomCode:created.roomCode })).success);
  }

  const nextSnapshot = waitFor(clients[0], 'room:state');
  const started = await emit(clients[0], 'dalmuti:start', { roomCode:created.roomCode });
  assert.ok(started.success, started.error);
  const hostView = await nextSnapshot;
  assert.equal(hostView.gameType, 'DALMUTI');
  assert.equal(hostView.mySecret.hand.length > 0, true);
  assert.equal(JSON.stringify(hostView.dalmuti).includes('"hand"'), false);
  assert.equal(hostView.dalmuti.players.every((player) => typeof player.handCount === 'number'), true);

  const clientById = new Map(ids.map((id, index) => [id, clients[index]]));
  const acknowledgePendingPresentation = async () => {
    const currentRoom = rooms[created.roomCode];
    const gate = currentRoom.dalmutiPresentationGate;
    if (!gate) return;
    await Promise.all(gate.waitingFor.map((id) => emit(clientById.get(id), 'dalmuti:presentation-ack', { roomCode:created.roomCode, eventId:gate.eventId })));
  };
  let room = rooms[created.roomCode];
  let guard = 0;
  while (room.gameStateObject.playPhase !== 'TURN_INPUT' && guard++ < 10) {
    const actorId = room.gameStateObject.currentTurnPlayerId;
    const command = chooseBotCommand(room.gameStateObject, actorId);
    const result = await emit(clientById.get(actorId), 'dalmuti:command', { roomCode:created.roomCode, command });
    assert.ok(result.success, result.error);
    await acknowledgePendingPresentation();
    room = rooms[created.roomCode];
  }
  assert.equal(room.gameStateObject.playPhase, 'TURN_INPUT');
  const actorId = room.gameStateObject.currentTurnPlayerId;
  const command = chooseBotCommand(room.gameStateObject, actorId);
  const staleVersion = room.gameStateObject.stateVersion;
  const eventPromise = waitForMatching(clients[(ids.indexOf(actorId) + 1) % clients.length], 'dalmuti:event', (envelope) => ['SET_PLAYED','PASSED'].includes(envelope?.event?.type));
  const playResult = await emit(clientById.get(actorId), 'dalmuti:command', { roomCode:created.roomCode, command });
  assert.ok(playResult.success, playResult.error);
  const event = await eventPromise;
  assert.ok(['SET_PLAYED','PASSED'].includes(event.event.type));
  assert.equal(rooms[created.roomCode].dalmutiPresentationGate?.eventId, event.eventId);
  await acknowledgePendingPresentation();
  assert.equal(rooms[created.roomCode].dalmutiPresentationGate, null);
  const staleResult = await emit(clientById.get(rooms[created.roomCode].gameStateObject.currentTurnPlayerId), 'dalmuti:command', {
    roomCode:created.roomCode,
    command:{ ...chooseBotCommand(rooms[created.roomCode].gameStateObject, rooms[created.roomCode].gameStateObject.currentTurnPlayerId), expectedStateVersion:staleVersion },
  });
  assert.equal(staleResult.success, false, 'stale commands are rejected');
  service.clearTimers(created.roomCode);
  await service.disconnectExpired(created.roomCode, ids[1]);
  assert.equal(rooms[created.roomCode].players.find((player) => player.id === ids[1]).isBot, true, 'expired seat becomes a bot');
  const lateReconnect = await emit(clients[1], 'room:reconnect', { roomCode:created.roomCode, ...credentials[1] });
  assert.equal(lateReconnect.success, false, 'a bot-taken seat cannot be reclaimed late');
  console.log('Dalmuti Socket.IO start, private projection and command routing passed.');
} finally {
  clients.forEach((client) => client.disconnect());
  service.clearTimers(rooms[Object.keys(rooms)[0]]?.code || '');
  await new Promise((resolve) => io.close(resolve));
}
