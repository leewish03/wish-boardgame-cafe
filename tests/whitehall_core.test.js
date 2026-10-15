import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as core from '../packages/whitehall-core/src/index.js';
import * as map from '../packages/whitehall-core/src/map.js';
import { jackMoves, legalActions } from '../packages/whitehall-core/src/rules.js';
import { investigatorBelief, investigatorWeights } from '../packages/whitehall-core/src/ai.js';

const evidence = { invocation: 'node tests/whitehall_core.test.js', scenarios: [], matches: [] };
function test(name, run) { run(); evidence.scenarios.push({ name, observable: 'all assertions passed', passed: true }); }
const players = count => Array.from({ length: count }, (_, i) => ({ id: `p${i}`, nickname: `Player ${i}`, isHost: i === 0, isBot: true }));
const exec = (state, body) => core.executeCommand(state, { playerId: core.getPendingActors(state)[0], ...body }).nextState;
function setup() {
  let s = core.createInitialState(players(2));
  s = exec(s, { type: 'START_MATCH', playerId: 'p0' });
  s = exec(s, { type: 'SET_DISCOVERIES', locations: [33, 46, 159, 147] });
  for (let i = 0; i < 3; i++) s = exec(s, { type: 'DEPLOY', pawnId: s.police[i].id, to: map.startingCrossings[i] });
  return exec(s, { type: 'CHOOSE_START', to: 147 });
}

test('Authentic graph: 189 circles, 174 crossings, 495 undirected edges, 116 alley blocks, 5 water groups, 6 deployments', () => {
  assert.deepEqual([map.circles.length, map.crossings.length, map.edges.length, map.alleyGroups.length, map.waterGroups.length, map.startingCrossings.length], [189, 174, 495, 116, 5, 6]);
  assert.equal(new Set(map.circles.map(c => c.id)).size, 189);
  for (const [a, b] of map.edges) { assert.ok(map.adjacency[a].includes(b)); assert.ok(map.adjacency[b].includes(a)); }
  assert.equal(new Set(map.edges.map(e => [...e].sort().join(':'))).size, 495);
  const seen = new Set(['1']), queue = ['1'];
  for (let i = 0; i < queue.length; i++) for (const next of map.adjacency[queue[i]]) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  assert.equal(seen.size, 363);
  for (const g of map.alleyGroups) for (const id of g) assert.notEqual(map.circleById[id].color, 'blue');
  for (const g of map.waterGroups) for (const id of g) assert.equal(map.circleById[id].color, 'blue');
});
test('Official examples: quadrants, 147 to 114 walk, 40-37-34 coach, 85-121 alley, 138-157 boat', () => {
  assert.deepEqual([33, 46, 159, 147].map(id => map.circleById[id].quadrant), ['NW', 'NE', 'SW', 'SE']);
  assert.ok(map.neighbors(147, 'JACK').includes(114));
  assert.ok(map.neighbors(40, 'JACK').includes(37)); assert.ok(map.neighbors(37, 'JACK').includes(34));
  assert.ok(map.groupDestinations(85, map.alleyGroups).includes(121));
  assert.ok(map.groupDestinations(138, map.waterGroups).includes(157));
});
test('Setup validates role, host, four white quadrants, deployment priority and unique starts', () => {
  assert.throws(() => core.createInitialState(players(2), { jackPlayerId: 'outsider' }));
  const initial = core.createInitialState(players(4), { jackPlayerId: 'p3' });
  assert.deepEqual(initial.police.map(p => p.controllerId), ['p0', 'p1', 'p2']);
  assert.throws(() => exec(initial, { type: 'START_MATCH', playerId: 'p3' }));
  let s = exec(initial, { type: 'START_MATCH', playerId: 'p0' });
  assert.throws(() => exec(s, { type: 'SET_DISCOVERIES', locations: [33, 33, 159, 147] }));
  assert.throws(() => exec(s, { type: 'SET_DISCOVERIES', locations: [33, 46, 138, 147] }));
  s = exec(s, { type: 'SET_DISCOVERIES', locations: [33, 46, 159, 147] });
  assert.throws(() => exec(s, { type: 'DEPLOY', pawnId: 'BLUE', to: map.startingCrossings[0] }));
  s = exec(s, { type: 'DEPLOY', pawnId: 'YELLOW', to: map.startingCrossings[0] });
  assert.throws(() => exec(s, { type: 'DEPLOY', pawnId: 'BLUE', to: map.startingCrossings[0] }));
  assert.deepEqual(core.getPendingActors(s), ['p1']);
});
test('Movement blocking, distinct coach steps, blue restriction, budgets and undiscovered-goal restriction', () => {
  const s = setup(); s.position = 40; s.route = [40]; s.police.forEach(p => { p.position = null; });
  assert.ok(jackMoves(s).some(m => m.mode === 'COACH' && m.path.join() === '37,34'));
  const crossing = map.adjacency['40'].find(id => map.neighbors(40, 'JACK', [id]).length < map.neighbors(40, 'JACK').length);
  assert.ok(crossing); s.police[0].position = crossing;
  assert.ok(jackMoves(s).filter(m => m.mode === 'WALK').length < map.neighbors(40, 'JACK').length);
  for (const m of jackMoves(s).filter(m => m.mode === 'COACH')) { assert.equal(new Set([40, ...m.path]).size, 3); assert.ok(m.path.every(id => map.circleById[id].color !== 'blue')); }
  s.moveCount = 14; assert.ok(jackMoves(s).every(m => m.mode !== 'COACH'));
  s.position = 85; s.moveCount = 0; s.discoveries = [121]; s.revealed = [];
  assert.ok(jackMoves(s).every(m => m.mode === 'WALK' || !m.path.includes(121)));
  s.discoveries = []; const next = exec(s, { type: 'JACK_MOVE', mode: 'ALLEY', path: [121] });
  assert.equal(next.specials.ALLEY, 1); assert.equal(next.moveCount, 1);
  assert.deepEqual(s.route, [40]); assert.equal(s.stateVersion + 1, next.stateVersion);
});
test('Investigator zero/two-step movement, overlap rejection, repeated searches and no arrest after search', () => {
  let s = setup(); s.playPhase = 'POLICE_MOVE';
  const one = map.neighbors(s.police[0].position, 'POLICE');
  const two = legalActions(s, 'p1').destinations.find(id => id !== s.police[0].position && !one.includes(id));
  assert.ok(two, 'A destination exactly two crossings away must be legal');
  const movedTwo = exec(s, { type: 'POLICE_MOVE', pawnId: 'YELLOW', to: two });
  assert.equal(movedTwo.police[0].position, two);
  const intermediate = one.find(id => map.neighbors(id, 'POLICE').includes(two));
  const occupied = structuredClone(s); occupied.police[1].position = intermediate;
  assert.ok(legalActions(occupied, 'p1').destinations.includes(two), 'Investigators may pass another figure');
  for (let i = 0; i < 3; i++) { const pawn = s.police[i]; s = exec(s, { type: 'POLICE_MOVE', pawnId: pawn.id, to: pawn.position }); }
  assert.equal(s.playPhase, 'POLICE_ACTION');
  const targets = map.adjacentCircles(s.police[0].position); assert.ok(targets.length >= 2);
  s.route = [targets[1]]; s.position = targets[1];
  s = exec(s, { type: 'SEARCH', pawnId: 'YELLOW', to: targets[0] });
  assert.equal(s.pawnIndex, 0);
  assert.equal(legalActions(s, 'p1').canEnd, false);
  assert.throws(() => exec(s, { type: 'END_ACTION', pawnId: 'YELLOW' }), /수색을 계속/);
  assert.throws(() => exec(s, { type: 'ARREST', pawnId: 'YELLOW', to: targets[1] }));
  s = exec(s, { type: 'SEARCH', pawnId: 'YELLOW', to: targets[1] });
  assert.equal(s.pawnIndex, 1); assert.ok(s.clues.includes(targets[1]));
  s.playPhase = 'POLICE_MOVE'; s.pawnIndex = 0;
  assert.throws(() => exec(s, { type: 'POLICE_MOVE', pawnId: 'YELLOW', to: s.police[1].position }));
});
test('Initial pass is legal; a failed search must continue until all adjacent locations are exhausted', () => {
  let s = setup(); s.playPhase = 'POLICE_ACTION'; s.route = [];
  assert.equal(legalActions(s, 'p1').canEnd, true);
  assert.equal(exec(s, { type: 'END_ACTION', pawnId: 'YELLOW' }).pawnIndex, 1);
  const targets = legalActions(s, 'p1').searchTargets;
  assert.ok(targets.length > 1);
  for (let index = 0; index < targets.length; index++) {
    s = exec(s, { type: 'SEARCH', pawnId: 'YELLOW', to: targets[index] });
    if (index < targets.length - 1) {
      assert.equal(s.pawnIndex, 0);
      assert.equal(legalActions(s, 'p1').canEnd, false);
      assert.throws(() => exec(s, { type: 'END_ACTION', pawnId: 'YELLOW' }));
    }
  }
  assert.equal(s.pawnIndex, 1);
  assert.deepEqual(s.searched, []);
  assert.equal(legalActions(s, 'p1').canEnd, true);
});
test('Arrival and fifteenth-step arrest precedes discovery; round reset and all-discovery victory', () => {
  let s = setup(); s.moveCount = 15; s.playPhase = 'POLICE_ACTION';
  const to = map.adjacentCircles(s.police[0].position)[0]; s.position = to; s.discoveries = [to, 46, 159, 147];
  const arrested = exec(s, { type: 'ARREST', pawnId: 'YELLOW', to });
  assert.equal(arrested.outcome.reason, 'ARREST'); assert.ok(!arrested.revealed.includes(to));
  for (let i = 0; i < 3; i++) s = exec(s, { type: 'END_ACTION', pawnId: s.police[i].id });
  assert.equal(s.playPhase, 'RESOLVE_TURN');
  const result = core.executeCommand(s, core.getAutomaticCommand(s)); s = result.nextState;
  assert.equal(s.roundNumber, 2); assert.equal(s.moveCount, 0); assert.deepEqual(s.clues, []); assert.deepEqual(s.route, [to]);
  assert.ok(result.events.some(e => e.type === 'DISCOVERY_REVEALED'));
  s.revealed = [46, 159, 147]; s.playPhase = 'RESOLVE_TURN';
  s = exec(s, { type: 'RESOLVE_TURN' }); assert.equal(s.outcome.winner, 'JACK');
  const timeout = setup(); timeout.moveCount = 15; timeout.playPhase = 'RESOLVE_TURN'; timeout.position = 114;
  assert.equal(exec(timeout, { type: 'RESOLVE_TURN' }).outcome.reason, 'TIME_EXPIRED');
});
test('Public/private projections and fair detective decisions are invariant to hidden route/goals', () => {
  const s = setup(), changed = structuredClone(s);
  changed.position = 99; changed.route = [147, 99]; changed.discoveries = [1, 4, 150, 189]; changed.seed = 999;
  assert.deepEqual(core.getPublicView(s), core.getPublicView(changed));
  assert.deepEqual(core.getBotObservation(s, 'p1'), core.getBotObservation(changed, 'p1'));
  assert.equal(core.getPrivateView(s, 'outsider'), null);
  const move = jackMoves(s)[0]; const result = core.executeCommand(s, { type: 'JACK_MOVE', playerId: 'p0', ...move });
  assert.ok(core.projectEvents(result.events, 'p0').some(e => e.type === 'JACK_ROUTE'));
  assert.ok(core.projectEvents(result.events, 'p1').every(e => !('path' in e) && !('from' in e)));
  assert.ok(investigatorBelief(core.getPublicView(result.nextState)).includes(result.nextState.position));
  const a = result.nextState, b = structuredClone(a); b.position = 99; b.route = [99]; b.discoveries = [1, 4, 150, 189];
  assert.deepEqual(core.chooseBotCommand(core.getBotObservation(a, 'p1'), 'p1'), core.chooseBotCommand(core.getBotObservation(b, 'p1'), 'p1'));
});

test('Boat use, special depletion across rounds, forced trap and authorization rejection', () => {
  let s = setup(); s.position = 138; s.route = [138];
  s = exec(s, { type: 'JACK_MOVE', mode: 'BOAT', path: [157] });
  assert.equal(s.position, 157); assert.equal(s.moveCount, 1); assert.equal(s.specials.BOAT, 1);
  assert.throws(() => exec(s, { type: 'POLICE_MOVE', playerId: 'outsider', pawnId: 'YELLOW', to: s.police[0].position }));
  s.playPhase = 'RESOLVE_TURN'; s.discoveries.push(157);
  s = exec(s, { type: 'RESOLVE_TURN' }); assert.equal(s.specials.BOAT, 1);
  s.specials = { COACH: 0, ALLEY: 0, BOAT: 0 };
  const trap = map.circles.find(c => map.adjacency[c.id].length <= 3);
  s.position = trap.id;
  map.adjacency[trap.id].forEach((crossing, i) => { s.police[i].position = crossing; });
  assert.deepEqual(core.getAutomaticCommand(s), { type: 'TRAPPED' });
  s = exec(s, { type: 'TRAPPED' }); assert.equal(s.outcome.reason, 'TRAPPED');
  assert.deepEqual(core.getPendingActors(s), []);
});

test('Pursuit probabilities preserve feasible endpoints and failed arrests remove only current location', () => {
  let s=setup();const move=jackMoves(s)[0];s=exec(s,{type:'JACK_MOVE',...move});
  const view=core.getPublicView(s),weights=investigatorWeights(view);
  assert.ok(weights.get(s.position)>0);
  assert.ok(Math.abs([...weights.values()].reduce((sum,value)=>sum+value,0)-1)<1e-9);
  const target=[...weights].find(([,value])=>value>0)[0];
  view.history.push({type:'ARREST_ATTEMPTED',location:target,found:false});
  assert.equal(investigatorWeights(view).get(target),undefined);
  const altered=structuredClone(s);altered.position=99;altered.route=[99];altered.discoveries=[1,4,150,189];altered.seed=999;
  assert.deepEqual(investigatorWeights(core.getPublicView(s)),investigatorWeights(core.getPublicView(altered)));
});

test('Jack completes stationary-blocker seed 56 and spends the final slot on a legal discovery',()=>{
  let s=core.createInitialState(players(2),{},56),steps=0,maxDecisionMs=0;
  s=exec(s,{type:'START_MATCH',playerId:'p0'});
  const positions=['JD','JH','FP'],routes=[];
  while(s.matchState!=='GAME_OVER'&&steps++<1000) {
    const actor=core.getPendingActors(s)[0],observation=core.getBotObservation(s,actor);
    let command=core.getAutomaticCommand(s);
    if(!command&&s.playPhase==='DEPLOY')command={type:'DEPLOY',pawnId:observation.private.legal.pawnId,to:positions[s.pawnIndex],playerId:actor};
    if(!command&&s.playPhase==='POLICE_MOVE')command={type:'POLICE_MOVE',pawnId:observation.private.legal.pawnId,to:s.police[s.pawnIndex].position,playerId:actor};
    if(!command&&s.playPhase==='POLICE_ACTION')command={type:'END_ACTION',pawnId:observation.private.legal.pawnId,playerId:actor};
    if(!command){const started=performance.now();command=core.chooseBotCommand(observation,actor);maxDecisionMs=Math.max(maxDecisionMs,performance.now()-started);assert.deepEqual(command,core.chooseBotCommand(structuredClone(observation),actor));}
    assert.ok(command);if(command.type==='JACK_MOVE')routes.push({round:s.roundNumber,slots:s.moveCount,command});
    s=core.executeCommand(s,command).nextState;
  }
  assert.equal(s.outcome?.reason,'ALL_DISCOVERIES');
  evidence.stationaryBlockers={seed:56,positions,steps,maxDecisionMs,routes,outcome:s.outcome};
  s=setup();s.moveCount=14;
  s.position=map.neighbors(46,'JACK',s.police.map(p=>p.position))[0];s.route=[s.position];
  const command=core.chooseBotCommand(core.getBotObservation(s,'p0'),'p0');
  assert.equal(command.mode,'WALK');assert.ok(s.discoveries.filter(id=>!s.revealed.includes(id)).includes(command.path[0]));
});

for (const count of [2, 4]) for (const seed of [1, 7, 42]) {
  test(`Full deterministic ${count}-player AI match seed ${seed}`, () => {
    const run = () => {
      let s = core.createInitialState(players(count), { jackPlayerId: seed === 7 ? `p${count - 1}` : 'p0' }, seed);
      s = exec(s, { type: 'START_MATCH', playerId: 'p0' });
      let steps = 0;
      while (s.matchState !== 'GAME_OVER' && steps < 1000) {
        const actor = core.getPendingActors(s)[0];
        const command = core.getAutomaticCommand(s) ?? core.chooseBotCommand(core.getBotObservation(s, actor), actor);
        assert.ok(command, `No command in ${s.playPhase}`);
        const before = s.stateVersion; s = core.executeCommand(s, command).nextState;
        assert.equal(s.stateVersion, before + 1); steps++;
        if (s.playPhase === 'POLICE_MOVE') assert.ok(investigatorBelief(core.getPublicView(s)).includes(s.position));
      }
      assert.equal(s.matchState, 'GAME_OVER'); assert.ok(steps < 1000);
      return { steps, outcome: s.outcome, rounds: s.roundNumber, version: s.stateVersion };
    };
    const first = run(); assert.deepEqual(run(), first);
    evidence.matches.push({ count, seed, ...first });
  });
}
mkdirSync('output/new-games', { recursive: true });
writeFileSync('output/new-games/whitehall-core.json', JSON.stringify(evidence, null, 2));
mkdirSync('.omo/evidence/new-games', { recursive: true });
writeFileSync('.omo/evidence/new-games/whitehall-core.json', JSON.stringify(evidence, null, 2));
console.log(`Whitehall: ${evidence.scenarios.length} scenarios passed; ${evidence.matches.length} deterministic complete matches.`);
