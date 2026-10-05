import assert from 'node:assert/strict';
import { createPresentationState, enqueuePresentation, observePresentation, synchronizePresentation, completePresentation, toggleTaxSelection, visibleSetRanks, anchorPoint } from '../src/games/dalmuti/presentationState.js';

const room = (version, pending = false) => ({ code: 'TABLE', stateVersion: version, presentationPending: pending, dalmuti: {
  roundNumber: 1, hierarchy: ['p0', 'p1'], players: [{ id: 'p0', handCount: 2 }, { id: 'p1', handCount: 3 }],
  trick: { sets: [], passPlayerIds: [], completedCount: 0 }, currentTurnPlayerId: 'p0', matchState: 'PLAYING',
} });
const envelope = (type, index, count = 2, version = 2) => ({ eventId: `${type}-${version}`, stateVersion: version, eventIndex: index, eventCount: count, event: { id: `${type}-${version}`, type, actorId: 'p0', rank: 4, count: 1, jesterCount: 0, handCount: 1 } });
const model = createPresentationState();
observePresentation(model, room(1));
enqueuePresentation(model, envelope('TRICK_CLEARED', 1));
enqueuePresentation(model, envelope('PASSED', 0));
observePresentation(model, room(1));
assert.equal(model.queue.length, 2, 'an older snapshot cannot discard an incoming batch');
enqueuePresentation(model, envelope('PASSED', 0));
assert.equal(model.current, null, 'wait for the authoritative batch snapshot');
observePresentation(model, room(2, true));
assert.equal(model.current.event.type, 'PASSED', 'out of order delivery is sorted');
assert.equal(model.display.dalmuti.players[0].passed, true);
const pass = model.current;
assert.equal(completePresentation(model, pass.eventId, pass.generation), null, 'only the last event ACKs');
assert.equal(model.current.event.type, 'TRICK_CLEARED');
assert.equal(completePresentation(model, model.current.eventId, model.current.generation), 'TRICK_CLEARED-2');
assert.equal(model.display, model.latest);

synchronizePresentation(model, room(2));
enqueuePresentation(model, envelope('SET_PLAYED', 0, 2, 3));
enqueuePresentation(model, envelope('ROUND_ENDED', 1, 2, 3));
const result = room(3, true); result.dalmuti.matchState = 'ROUND_END'; result.dalmuti.outcome = { finishOrder: ['p0', 'p1'] };
observePresentation(model, result);
assert.equal(model.display.dalmuti.matchState, 'PLAYING', 'result waits for the final card flight');
const playing = model.current;
completePresentation(model, playing.eventId, playing.generation);
assert.equal(model.display.dalmuti.matchState, 'ROUND_END');
assert.equal(model.current.event.type, 'ROUND_ENDED');
observePresentation(model, room(3, false));
assert.equal(model.current, null, 'fallback settles unfinished motion');
assert.equal(completePresentation(model, playing.eventId, playing.generation), null, 'stale callbacks cannot mutate a reset');

synchronizePresentation(model, room(3));
observePresentation(model, room(4, true));
enqueuePresentation(model, envelope('SET_PLAYED', 0, 1, 4));
assert.equal(model.current.event.type, 'SET_PLAYED', 'snapshot-before-event delivery works');
synchronizePresentation(model, room(5));
assert.equal(model.display.stateVersion, 5, 'resync uses full authoritative pile');
enqueuePresentation(model, envelope('SET_PLAYED', 0, 1, 4));
assert.equal(model.current, null, 'old events cannot replay after reconnect');

assert.deepEqual(toggleTaxSelection({ 4: 1, 5: 1 }, 4, 4, 2), { 4: 0, 5: 1 });
assert.deepEqual(toggleTaxSelection({ 4: 2 }, 5, 3, 2), { 4: 2 });
assert.deepEqual(visibleSetRanks({ rank: 12, count: 8, jesterCount: 2 }), [12,12,12,12,13,13]);
assert.deepEqual(anchorPoint({ left: 130, top: 260, width: 20, height: 40 }, { left: 100, top: 200, width: 400, height: 600 }), { x: 40, y: 80 });
assert.equal(anchorPoint(null, {}), null);
assert.deepEqual(anchorPoint({ left: 130, top: 260, width: 20, height: 40 }, { left: 100, top: 200, width: 400, height: 600 }, 200, 300), { x: 20, y: 40 }, 'scaled ancestors share the overlay coordinate space');
console.log('Dalmuti event ordering, ACK, fallback, resync, tax limits, Jester display and coordinates passed.');
