import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { createInitialState, executeCommand } from '../packages/dalmuti-core/src/index.js';
import { roomRepository } from '../server/core/RoomRepository.js';
import { restoreRoom } from '../server/core/SupabaseRoomRepository.js';
import { createDalmutiService } from '../server/core/DalmutiService.js';
import { configureGameLifecycle } from '../server/shared/roomManager.js';

const service = createDalmutiService({ to: () => ({ emit() {} }), sockets: { sockets: new Map() } });
configureGameLifecycle('DALMUTI', { projectPublicState: (room, id) => service.projectRoomState(room, id) });
const players = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, nickname: `P${i}`, socketId: `s${i}`, isBot: false }));
const makeRoom = async (code, limit = 30) => {
  const { nextState } = executeCommand(createInitialState(players, { turnTimeoutSeconds: limit }, 42), { type: 'START_MATCH' });
  const room = { code, gameType: 'DALMUTI', hostId: 'p0', players: structuredClone(players), gameStateObject: nextState };
  service.syncRoom(room, nextState); await roomRepository.saveRoom(room); return room;
};
mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_000_000 });
try {
  const room = await makeRoom('TIMER1');
  room.gameStateObject.turnExpiresAt = Date.now() + 5000;
  room.players[1].isDisconnected = true;
  await service.pauseRoom(room.code, 'p1');
  const expiry = room.pauseExpiresAt;
  mock.timers.tick(10_000);
  room.players[2].isDisconnected = true;
  await service.pauseRoom(room.code, 'p2');
  assert.equal(room.pauseExpiresAt, expiry, 'second disconnect never extends grace');
  room.players[1].isDisconnected = false;
  await service.resumeRoom(room.code);
  assert.equal(room.isPaused, true, 'partial return stays paused');
  room.players[2].isDisconnected = false;
  await service.resumeRoom(room.code);
  assert.equal(room.gameStateObject.turnExpiresAt - Date.now(), 5000, 'remaining clock survives pause');

  const unlimited = await makeRoom('TIMER2', 0);
  unlimited.players[1].isDisconnected = true;
  await service.pauseRoom(unlimited.code, 'p1');
  unlimited.players[1].isDisconnected = false;
  await service.resumeRoom(unlimited.code);
  assert.equal(unlimited.gameStateObject.turnExpiresAt, 0);
  const envelopes = service.makeEventEnvelopes(room.gameStateObject, [{ id: 'played', type: 'SET_PLAYED' }, { id: 'clear', type: 'TRICK_CLEARED' }]);
  service.preparePresentation(room, envelopes);
  assert.equal(room.gameStateObject.turnExpiresAt, 0);
  assert.equal(envelopes[1].eventIndex, 1); assert.equal(envelopes[1].eventCount, 2);
  await service.releasePresentation(room.code, envelopes[1].eventId);
  assert.equal(room.gameStateObject.turnExpiresAt - Date.now(), 30_000);

  room.gameStateObject.matchState = 'ROUND_END'; room.gameStateObject.outcome = { advanceAt: Date.now() + 3000 };
  room.players[1].isDisconnected = true;
  await service.pauseRoom(room.code, 'p1');
  mock.timers.tick(1000);
  room.players[1].isDisconnected = false;
  await service.resumeRoom(room.code);
  assert.equal(room.gameStateObject.outcome.advanceAt - Date.now(), 3000);

  const saved = await makeRoom('RESTORE');
  saved.players[3].isBot = true;
  const restored = restoreRoom(saved);
  assert.equal(restored.players[3].isDisconnected, false);
  await roomRepository.saveRoom(restored);
  await service.restoreRooms();
  assert.ok(service.pauseTimers.has(restored.code));
  assert.equal(restored.pauseExpiresAt - Date.now(), 90_000);
  const explicitExpiry = { ...saved, isPaused: true, pauseExpiresAt: Date.now() + 1234 };
  assert.equal(restoreRoom(explicitExpiry).pauseExpiresAt, explicitExpiry.pauseExpiresAt);
  for (const current of await roomRepository.listRooms()) service.clearTimers(current.code);

  const multi = await makeRoom('MULTI');
  multi.players[1].isDisconnected = true; multi.players[2].isDisconnected = true;
  await service.pauseRoom(multi.code, 'p1');
  const originalDeadline = multi.pauseExpiresAt;
  const handBefore = JSON.stringify(multi.gameStateObject.secrets);
  await service.finalizeDeparture(multi.code, 'p0');
  assert.equal(multi.isPaused, true, 'connected departure cannot cancel somebody else\'s grace');
  assert.equal(multi.pauseExpiresAt, originalDeadline);
  // The last disconnected member returns at the expiry boundary before its queued callback runs.
  multi.players[2].isDisconnected = false;
  mock.timers.tick(90_000);
  await service.queues.get(multi.code);
  assert.equal(multi.players[1].isBot, true);
  assert.equal(multi.players[2].isBot, false, 'return at the boundary is respected by the callback');
  assert.equal(JSON.stringify(multi.gameStateObject.secrets), handBefore);
  assert.equal(multi.isPaused, false);
  assert.equal(service.pauseTimers.has(multi.code), false);
  service.clearTimers(multi.code);

  for (const phase of ['TURN_INPUT', 'REVOLUTION_DECISION', 'TAX_RETURN', 'MERCHANT_EXCHANGE', 'ROUND_END']) {
    const departure = await makeRoom(`PHASE${phase}`);
    departure.gameStateObject.playPhase = phase;
    const actorId = departure.gameStateObject.currentTurnPlayerId;
    if (phase === 'REVOLUTION_DECISION') departure.gameStateObject.revolutionCandidateId = actorId;
    if (phase === 'TAX_RETURN') departure.gameStateObject.tax = { currentDalmutiId: actorId, pairs: [{ dalmutiId: actorId, peonId: 'p2', count: 1, offered: [], returned: null }] };
    if (phase === 'MERCHANT_EXCHANGE') departure.gameStateObject.merchantExchange = { actorId, eligibleTargetIds: ['p2'] };
    if (phase === 'ROUND_END') {
      departure.gameStateObject.matchState = 'ROUND_END'; departure.gameStateObject.outcome = { advanceAt: Date.now() + 5000 };
    }
    for (const id of ['p1', departure.gameStateObject.currentTurnPlayerId]) {
      const result = await service.finalizeDeparture(departure.code, id);
      assert.equal(result.retainSeat, true);
      assert.equal(departure.gameStateObject.players.find((player) => player.id === id).isBot, true);
    }
    assert.equal(departure.players.length, 4, `${phase} preserves the table roster`);
    service.clearTimers(departure.code);
    await roomRepository.deleteRoom(departure.code);
  }

  const empty = restoreRoom(await makeRoom('EMPTY'));
  await roomRepository.saveRoom(empty);
  await service.restoreRooms();
  mock.timers.tick(90_000);
  await service.queues.get(empty.code);
  assert.equal(await roomRepository.getRoom(empty.code), null, 'unclaimed recovered table is deleted');
  for (const timers of [service.pauseTimers, service.turnTimers, service.botTimers, service.roundTimers, service.presentationTimers]) assert.equal(timers.has(empty.code), false);
  const terminal = await makeRoom('TERMINAL');
  terminal.gameStateObject.matchState = 'GAME_OVER'; terminal.players.slice(1).forEach((player) => { player.isBot = true; });
  const finalSnapshot = JSON.stringify(terminal.gameStateObject);
  const departure = await service.finalizeDeparture(terminal.code, 'p0');
  assert.equal(departure.roomDeleted, true);
  assert.equal(JSON.stringify(terminal.gameStateObject), finalSnapshot, 'terminal exit preserves the final game result');
  console.log('Dalmuti pause clocks, multi-disconnect, batch clocks and legacy restoration passed.');
} finally {
  for (const room of await roomRepository.listRooms()) { service.clearTimers(room.code); service.clearPauseTimer(room.code); }
  roomRepository.clear(); mock.timers.reset();
}
