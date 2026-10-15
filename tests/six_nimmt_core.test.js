import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '../packages/six-nimmt-core/src/index.js';

const checks = [];
function check(name, run) { run(); checks.push({ scenario: name, observable: 'PASS' }); }
const players = n => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nickname: `Player ${i}`, isHost: i === 0, isBot: true }));
function started(n = 2, seed = 19) {
  return core.executeCommand(core.createInitialState(players(n), {}, seed), { type: 'START_MATCH', playerId: 'p0' }).nextState;
}
function conservation(state) {
  const pending = state.playPhase === 'SELECTING' ? Object.values(state.selections) : state.queue.map(item => item.card);
  const cards = [...Object.values(state.hands).flat(), ...state.rows.flat(), ...Object.values(state.taken).flat(), ...state.unused, ...pending];
  assert.equal(cards.length, 104);
  assert.equal(new Set(cards).size, 104);
  assert(cards.every(card => card >= 1 && card <= 104));
}
check('bullhead values and nearest lower row', () => {
  assert.deepEqual([1, 5, 10, 11, 55, 99, 100, 104].map(core.bullheads), [1, 2, 3, 5, 7, 5, 3, 1]);
  assert.equal(core.nearestRow([[12], [37], [43], [58]], 44), 2);
  assert.equal(core.nearestRow([[12], [37], [43], [58]], 3), -1);
});
check('setup 2, 4, 10 players and immutable deterministic commands', () => {
  for (const n of [2, 4, 10]) {
    const initial = core.createInitialState(players(n), {}, 19);
    const before = structuredClone(initial);
    const state = core.executeCommand(initial, { type: 'START_MATCH', playerId: 'p0' }).nextState;
    assert.deepEqual(initial, before);
    assert.deepEqual(state, started(n));
    assert(Object.values(state.hands).every(hand => hand.length === 10));
    assert.equal(state.rows.length, 4);
    conservation(state);
  }
  assert.throws(() => core.createInitialState(players(1)));
  assert.throws(() => core.createInitialState(players(11)));
  assert.throws(() => core.createInitialState([players(2)[0], players(2)[0]]));
});
check('host, stale, duplicate, wrong-phase and malformed commands rejected', () => {
  const initial = core.createInitialState(players(2));
  assert.throws(() => core.executeCommand(initial, { type: 'START_MATCH', playerId: 'p1' }));
  let state = started();
  for (const command of [null, { type: 'NOPE', playerId: 'p0' }, { type: 'SELECT_CARD', playerId: 'stranger', card: 1 }, { type: 'SELECT_CARD', playerId: 'p0', card: 0 }, { type: 'SELECT_CARD', playerId: 'p0', card: state.hands.p0[0], expectedVersion: 0 }, { type: 'CHOOSE_ROW', playerId: 'p0', rowIndex: 0 }, { type: 'STEP_RESOLVE' }]) assert.throws(() => core.executeCommand(state, command));
  const card = state.hands.p0[0];
  state = core.executeCommand(state, { type: 'SELECT_CARD', playerId: 'p0', card }).nextState;
  assert.throws(() => core.executeCommand(state, { type: 'SELECT_CARD', playerId: 'p0', card }));
});
check('shuffle preserves full secret entropy and deterministic replay without 32-bit collisions', () => {
  const seed = '7bacae39e580c731aaab9ee36ef744385c25d11ef59e1c13c9d0f222d716eaaa';
  const state = started(4, seed);
  assert.equal(state.seed, seed);
  assert.deepEqual(state, started(4, seed));
  assert.notDeepEqual(state.hands, started(4, `${seed.slice(0, -1)}b`).hands);
  assert.notDeepEqual(started(4, 1).hands, started(4, 4294967297).hands);
  assert.equal('seed' in core.getPublicView(state), false);
  assert.equal('seed' in core.getPrivateView(state, 'p0'), false);
  assert.equal('seed' in core.getBotObservation(state, 'p0'), false);
  conservation(state);
});
check('secret commitment remains private until simultaneous reveal', () => {
  const original = started();
  const card = original.hands.p0[0];
  const committed = core.executeCommand(original, { type: 'SELECT_CARD', playerId: 'p0', card });
  assert.deepEqual(committed.events, [{ type: 'CARD_COMMITTED', playerId: 'p0', actorId: 'p0' }]);
  const publicView = core.getPublicView(committed.nextState);
  assert.deepEqual(publicView.queue, []);
  for (const key of ['seed', 'hands', 'selections', 'unused', 'taken']) assert(!(key in publicView));
  assert.equal(core.getPrivateView(committed.nextState, 'p0').selectedCard, card);
  assert.equal(core.getPrivateView(committed.nextState, 'p1').selectedCard, null);
  const revealed = core.executeCommand(committed.nextState, { type: 'SELECT_CARD', playerId: 'p1', card: original.hands.p1[0] });
  assert.equal(revealed.nextState.playPhase, 'RESOLVING');
  assert.equal(revealed.events[1].type, 'CARDS_REVEALED');
  assert(revealed.nextState.queue[0].card < revealed.nextState.queue[1].card);
  conservation(committed.nextState);
  conservation(revealed.nextState);
  publicView.rows[0][0] = -1;
  assert.notEqual(committed.nextState.rows[0][0], -1);
});
check('sixth card takes five, low card interrupts, one placement per step', () => {
  let state = started();
  state.rows = [[12, 14, 15, 21, 26], [37], [43], [58]];
  state.playPhase = 'RESOLVING';
  state.queue = [{ playerId: 'p0', card: 30 }, { playerId: 'p1', card: 36 }];
  const result = core.executeCommand(state, core.getAutomaticCommand(state));
  state = result.nextState;
  assert.deepEqual(state.rows[0], [30]);
  assert.equal(state.players[0].score, 6);
  assert.equal(state.queue.length, 1);
  assert.equal(result.events[0].type, 'ROW_TAKEN');
  state = core.executeCommand(state, core.getAutomaticCommand(state)).nextState;
  assert.deepEqual(state.rows[0], [30, 36]);
  assert.equal(state.turnNumber, 2);
  state.playPhase = 'RESOLVING';
  state.queue = [{ playerId: 'p0', card: 3 }, { playerId: 'p1', card: 9 }];
  state = core.executeCommand(state, core.getAutomaticCommand(state)).nextState;
  assert.equal(state.playPhase, 'CHOOSING_ROW');
  assert.equal(core.getAutomaticCommand(state), null);
  assert.deepEqual(core.getPendingActors(state), ['p0']);
  assert.throws(() => core.executeCommand(state, { type: 'CHOOSE_ROW', playerId: 'p1', rowIndex: 1 }));
  for (const rowIndex of [-1, 4, 0.5, '1']) assert.throws(() => core.executeCommand(state, { type: 'CHOOSE_ROW', playerId: 'p0', rowIndex }));
  state = core.executeCommand(state, { type: 'CHOOSE_ROW', playerId: 'p0', rowIndex: 1 }).nextState;
  assert.deepEqual(state.rows[1], [3]);
  state = core.executeCommand(state, core.getAutomaticCommand(state)).nextState;
  assert.deepEqual(state.rows[1], [3, 9]);
});
check('round ten finishes before threshold end, shared minimum wins', () => {
  let state = started(4);
  state.turnNumber = 10;
  state.playPhase = 'RESOLVING';
  state.rows = [[1], [20], [30], [40]];
  state.players.forEach((p, i) => { p.score = [66, 4, 4, 10][i]; });
  state.queue = [{ playerId: 'p0', card: 2 }, { playerId: 'p1', card: 3 }];
  state = core.executeCommand(state, core.getAutomaticCommand(state)).nextState;
  assert.equal(state.matchState, 'PLAYING');
  state = core.executeCommand(state, core.getAutomaticCommand(state)).nextState;
  assert.equal(state.matchState, 'GAME_OVER');
  assert.deepEqual(state.outcome.winnerIds, ['p1', 'p2']);
  assert.throws(() => core.executeCommand(state, { type: 'ADVANCE_ROUND', playerId: 'p0' }));
});
check('AI cannot distinguish swapped opponent hands or hidden commitments', () => {
  let state = started(4);
  state = core.executeCommand(state, { type: 'SELECT_CARD', playerId: 'p1', card: state.hands.p1[0] }).nextState;
  const changed = structuredClone(state);
  [changed.selections.p1, changed.hands.p2[0]] = [changed.hands.p2[0], changed.selections.p1];
  [changed.hands.p1[1], changed.hands.p3[1]] = [changed.hands.p3[1], changed.hands.p1[1]];
  changed.seed = 987654321;
  const a = core.getBotObservation(state, 'p0');
  const b = core.getBotObservation(changed, 'p0');
  assert.deepEqual(a, b);
  assert.deepEqual(core.chooseBotCommand(a, 'p0'), core.chooseBotCommand(b, 'p0'));
  assert.deepEqual(core.chooseBotCommand(a, 'p0'), core.chooseBotCommand(a, 'p0'));
});
const matches = [];
check('same-snapshot simultaneous choices accepted, earlier-turn replay rejected', () => {
  let state = started();
  const expectedVersion = state.stateVersion;
  assert.equal(state.selectionVersion, expectedVersion);
  for (const playerId of ['p0', 'p1']) state = core.executeCommand(state, { type: 'SELECT_CARD', playerId, card: state.hands[playerId][0], expectedVersion }).nextState;
  assert.equal(state.playPhase, 'RESOLVING');
  while (state.playPhase !== 'SELECTING') {
    const actor = core.getPendingActors(state)[0];
    const command = core.getAutomaticCommand(state) || core.chooseBotCommand(core.getBotObservation(state, actor), actor);
    state = core.executeCommand(state, command).nextState;
  }
  assert(state.selectionVersion > expectedVersion);
  assert.throws(() => core.executeCommand(state, { type: 'SELECT_CARD', playerId: 'p0', card: state.hands.p0[0], expectedVersion }));
  assert.throws(() => core.executeCommand(state, { type: 'SELECT_CARD', playerId: 'p0', card: state.hands.p0[0], expectedVersion: state.stateVersion + 1 }));
});
check('complete 2, 4, 10 player AI matches conserve all cards at every step', () => {
  for (const n of [2, 4, 10]) {
    let state = started(n, 100 + n);
    let steps = 0;
    while (state.matchState !== 'GAME_OVER' && steps < 10000) {
      conservation(state);
      const actor = core.getPendingActors(state)[0];
      const command = core.getAutomaticCommand(state) || core.chooseBotCommand(core.getBotObservation(state, actor), actor);
      assert(command);
      const before = state.stateVersion;
      state = core.executeCommand(state, command).nextState;
      assert.equal(state.stateVersion, before + 1);
      steps++;
    }
    conservation(state);
    assert.equal(state.matchState, 'GAME_OVER');
    assert(state.players.some(p => p.score >= 66));
    assert(state.outcome.winnerIds.length > 0);
    matches.push({ players: n, rounds: state.roundNumber, steps, scores: state.outcome.scores });
  }
});
fs.mkdirSync('output/new-games', { recursive: true });
fs.mkdirSync('.omo/evidence/new-games', { recursive: true });
const evidence = JSON.stringify({ invocation: 'node tests/six_nimmt_core.test.js', passed: true, checks, matches }, null, 2);
fs.writeFileSync('output/new-games/six-nimmt-core.json', evidence);
fs.writeFileSync('.omo/evidence/new-games/six-nimmt-core.json', evidence);
console.log(`PASS: ${checks.length} Six Nimmt scenarios; full 2/4/10 player matches. Evidence: output/new-games/six-nimmt-core.json`);
