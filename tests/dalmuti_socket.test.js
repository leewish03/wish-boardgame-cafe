import http from 'node:http';
import assert from 'node:assert/strict';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { initRoomManager, configureGameLifecycle, rooms } from '../server/shared/roomManager.js';
import { createDalmutiService } from '../server/core/DalmutiService.js';
import { registerDalmutiController } from '../server/games/dalmutiController.js';
import { chooseBotCommand } from '../packages/dalmuti-core/src/index.js';
import { mock } from 'node:test';

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
  forfeit: (code, id) => service.finalizeDeparture(code, id),
  projectPublicState: (room, id) => service.projectRoomState(room, id),
});
registerDalmutiController(io, service);
await new Promise((resolve) => server.listen(0, resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const clients = Array.from({ length: 4 }, () => ClientIO(url, { transports: ['websocket'] }));
let missingRoomClient = null;

try {
  await Promise.all(clients.map((client) => waitFor(client, 'connect')));
  missingRoomClient = ClientIO(url, { transports: ['websocket'] });
  await waitFor(missingRoomClient, 'connect');
  const unavailable = waitFor(missingRoomClient, 'room:unavailable');
  const missingView = await emit(missingRoomClient, 'dalmuti:view-ready', { roomCode:'GONE42' });
  assert.equal(missingView.success, false, 'a stale Dalmuti table is explicitly rejected');
  assert.match(missingView.error, /방을 찾을 수 없습니다/);
  assert.match((await unavailable).error, /방을 찾을 수 없습니다/, 'the client receives the room-unavailable signal needed to leave its stale table');

  const created = await emit(clients[0], 'room:create', { gameType:'DALMUTI', nickname:'Host', maxPlayers:4, roundCount:5, turnTimeLimit:0 });
  assert.ok(created.success);
  const ids = [created.userId];
  const credentials = [{ userId:created.userId, sessionToken:created.sessionToken }];
  for (let index = 1; index < clients.length; index += 1) {
    const joined = await emit(clients[index], 'room:join', { roomCode:created.roomCode, nickname:`P${index}` });
    assert.ok(joined.success); ids.push(joined.userId); credentials.push({ userId:joined.userId, sessionToken:joined.sessionToken });
    assert.ok((await emit(clients[index], 'room:ready', { roomCode:created.roomCode })).success);
  }

  const openingEvents = [];
  const captureOpeningEvent = (envelope) => openingEvents.push(envelope?.event?.type);
  clients[0].on('dalmuti:event', captureOpeningEvent);
  const openingReady = waitForMatching(clients[0], 'dalmuti:event', (envelope) => envelope?.event?.type === 'OPENING_READY');
  const nextSnapshot = waitFor(clients[0], 'room:state');
  const started = await emit(clients[0], 'dalmuti:start', { roomCode:created.roomCode });
  assert.ok(started.success, started.error);
  await openingReady;
  clients[0].off('dalmuti:event', captureOpeningEvent);
  assert.deepEqual(openingEvents.slice(0, 2), ['ROUND_DEALT', 'OPENING_READY'], 'the opening clears the presentation before enabling the first lead');
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
  await acknowledgePendingPresentation();
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
  const beforeDuplicate = JSON.stringify(rooms[created.roomCode].gameStateObject.secrets);
  const duplicate = await emit(clientById.get(actorId), 'dalmuti:command', { roomCode:created.roomCode, command });
  assert.equal(duplicate.success, false, 'rapid second click is blocked during the batch');
  assert.equal(JSON.stringify(rooms[created.roomCode].gameStateObject.secrets), beforeDuplicate);
  assert.equal(rooms[created.roomCode].dalmutiPresentationGate?.eventId, event.eventId);
  await acknowledgePendingPresentation();
  assert.equal(rooms[created.roomCode].dalmutiPresentationGate, null);
  const staleResult = await emit(clientById.get(rooms[created.roomCode].gameStateObject.currentTurnPlayerId), 'dalmuti:command', {
    roomCode:created.roomCode,
    command:{ ...chooseBotCommand(rooms[created.roomCode].gameStateObject, rooms[created.roomCode].gameStateObject.currentTurnPlayerId), expectedStateVersion:staleVersion },
  });
  assert.equal(staleResult.success, false, 'stale commands are rejected');
  service.clearTimers(created.roomCode);
  clients[1].disconnect();
  await waitForMatching(clients[0], 'room:state', (view) => view.isPaused);
  assert.equal(service.pauseTimers.has(created.roomCode), true, 'real disconnect schedules the grace timer');
  // Advance the actual registered deadline through the standard timer callback.
  mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  service.schedulePause(rooms[created.roomCode]);
  mock.timers.tick(90_000);
  await service.queues.get(created.roomCode);
  mock.timers.reset();
  assert.equal(rooms[created.roomCode].players.find((player) => player.id === ids[1]).isBot, true, 'expired seat becomes a bot');
  assert.ok(
    ['AGGRESSIVE', 'DEFENSIVE', 'CALCULATING', 'STRATEGIC', 'INFORMATIVE'].includes(rooms[created.roomCode].gameStateObject.players.find((player) => player.id === ids[1]).botProfile),
    'an expired seat receives a strategy profile before its bot turn is scheduled',
  );
  clients[1].connect();
  await waitFor(clients[1], 'connect');
  const lateReconnect = await emit(clients[1], 'room:reconnect', { roomCode:created.roomCode, ...credentials[1] });
  assert.equal(lateReconnect.success, false, 'a bot-taken seat cannot be reclaimed late');
  const beforeDeparture = room.gameStateObject.secrets[ids[2]].hand.length;
  assert.ok((await emit(clients[2], 'room:forfeit', { roomCode:created.roomCode })).success);
  assert.equal(room.players.length, 4, 'explicit departure retains the Dalmuti seat');
  assert.equal(room.gameStateObject.secrets[ids[2]].hand.length, beforeDeparture);
  assert.equal(room.gameStateObject.players.find((p) => p.id === ids[2]).isBot, true);
  assert.ok((await emit(clients[0], 'room:forfeit', { roomCode:created.roomCode })).success);
  assert.equal(room.hostId, ids[3], 'host transfers to the remaining connected human');
  assert.ok((await emit(clients[3], 'room:forfeit', { roomCode:created.roomCode })).success);
  assert.equal(rooms[created.roomCode], undefined, 'last human departure deletes the room');
  assert.equal(service.pauseTimers.has(created.roomCode), false);
  console.log('Dalmuti Socket.IO start, private projection and command routing passed.');
} finally {
  missingRoomClient?.disconnect();
  clients.forEach((client) => client.disconnect());
  service.clearTimers(rooms[Object.keys(rooms)[0]]?.code || '');
  for (const code of service.pauseTimers.keys()) service.clearPauseTimer(code);
  mock.timers.reset();
  await new Promise((resolve) => io.close(resolve));
}
