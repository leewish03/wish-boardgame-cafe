import assert from 'node:assert/strict';
import {
  DALMUTI_RANKS, createDeck, createInitialState, executeCommand, getLegalPlays,
  assignBotProfile, chooseBotCommand, chooseTimeoutCommand, getBotPerspective, getPublicView, getPrivateView,
} from '../packages/dalmuti-core/src/index.js';

const players = Array.from({ length: 6 }, (_, index) => ({
  id: `p${index}`, nickname: `P${index}`, avatarUrl: '', isHost: index === 0, isBot: true,
}));

const totalCards = (state) => {
  const taxCards = (state.tax?.pairs || []).reduce((sum, pair) => sum + (pair.offered?.length || 0) + (pair.returned?.length || 0), 0);
  return Object.values(state.secrets).reduce((sum, secret) => sum + secret.hand.length, 0)
    + state.discardedCards.length
    + state.trick.sets.reduce((sum, set) => sum + set.cards.length, 0)
    + taxCards;
};

assert.equal(createDeck({ useStrippedDeck: false }, 8).length, 80, 'full deck has 80 cards');
assert.deepEqual(Object.values(DALMUTI_RANKS), ['달무티','대주교','시종장','남작부인','수녀원장','기사','재봉사','석공','요리사','양치기','광부','농노','어릿광대'], 'Korean-edition card names are canonical');
assert.equal(createDeck({ useStrippedDeck: true }, 5).length, 68, 'five-player stripped deck has 68 cards');
assert.equal(createDeck({ useStrippedDeck: true }, 4).length, 57, 'four-player stripped deck has 57 cards');

let state = createInitialState(players, { roundCount: 5, turnTimeoutSeconds: 0 }, 4242);
assert.deepEqual(state.players.slice(0, 3).map((player) => player.botProfile), ['CAUTIOUS', 'BALANCED', 'AGGRESSIVE'], 'bots receive stable distinct table personalities');
const reconnectReplacementState = createInitialState(players.slice(0, 4).map((player, index) => ({ ...player, isBot: index !== 0 })), { turnTimeoutSeconds: 0 }, 77);
const reconnectProfile = assignBotProfile(reconnectReplacementState, 'p0');
assert.ok(['CAUTIOUS', 'BALANCED', 'AGGRESSIVE'].includes(reconnectProfile), 'a disconnected human promoted to bot receives a stable strategy profile');
let startResult = executeCommand(state, { type: 'START_MATCH', playerId: 'p0' });
state = startResult.nextState;
assert.equal(state.roundNumber, 1);
assert.equal(totalCards(state), 80);
assert.equal(new Set(state.hierarchy).size, players.length, 'random seats yield a complete hierarchy');
const firstDalmutiOwner = state.players.find((player) => state.secrets[player.id].hand.some((card) => card.rank === 1)).id;
assert.equal(state.hierarchy[0], firstDalmutiOwner, 'the dealt Dalmuti card owner is the first-round leader');
assert.equal(state.currentTurnPlayerId, firstDalmutiOwner, 'the dealt Dalmuti card owner takes the opening turn');
assert.equal(state.tax, null, 'the first round has no tax exchange');
assert.equal(state.revolutionCandidateId, null, 'the first round never prompts a revolution');
assert.deepEqual(startResult.events.map((event) => event.type), ['ROUND_DEALT', 'OPENING_READY'], 'opening events explicitly clear then unlock the table');
const rolesById = new Map(state.players.map((player) => [player.id, player.role]));
assert.equal(rolesById.get(state.hierarchy[0]), '달무티');
assert.equal(rolesById.get(state.hierarchy[1]), '총리대신');
assert.equal(rolesById.get(state.hierarchy.at(-2)), '소작농');
assert.equal(rolesById.get(state.hierarchy.at(-1)), '농노');

let firstRoundWithJesterPair = null;
for (let seed = 1; seed <= 500 && !firstRoundWithJesterPair; seed += 1) {
  let candidate = createInitialState(players.slice(0, 4), { turnTimeoutSeconds: 0 }, seed);
  ({ nextState: candidate } = executeCommand(candidate, { type: 'START_MATCH', playerId: 'p0' }));
  if (Object.values(candidate.secrets).some((secret) => secret.hand.filter((card) => card.rank === 13).length === 2)) firstRoundWithJesterPair = candidate;
}
assert.ok(firstRoundWithJesterPair, 'a deterministic first-round Jester-pair deal was found');
assert.equal(firstRoundWithJesterPair.playPhase, 'TURN_INPUT', 'a first-round Jester pair never opens a revolution prompt');
assert.equal(firstRoundWithJesterPair.tax, null, 'a first-round Jester pair still has no tax');

let safety = 0;
while (state.matchState === 'PLAYING' && safety++ < 5000) {
  const actor = state.currentTurnPlayerId;
  const command = chooseBotCommand(state, actor);
  assert.ok(command, `bot command exists in ${state.playPhase}`);
  const beforeTotal = totalCards(state);
  ({ nextState: state } = executeCommand(state, command));
  const afterTotal = totalCards(state);
  assert.equal(afterTotal, beforeTotal, `cards are conserved after ${command.type}`);
}
assert.equal(state.matchState, 'ROUND_END', 'bots finish a complete round');
assert.equal(state.finishOrder.length, players.length);
assert.equal(new Set(state.finishOrder).size, players.length);

const publicView = getPublicView(state);
assert.equal(JSON.stringify(publicView).includes('"hand"'), false, 'public view has no secret hands');
assert.ok(Array.isArray(getPrivateView(state, state.players[0].id).hand));

// Bots must be given only their own cards and a bounded journal of public
// actions.  A bot perspective must never become a back door to other hands.
let botInspectionState = createInitialState(players.slice(0, 4), { useStrippedDeck: false, turnTimeoutSeconds: 0 }, 818);
({ nextState: botInspectionState } = executeCommand(botInspectionState, { type: 'START_MATCH', playerId: 'p0' }));
const botPerspective = getBotPerspective(botInspectionState, 'p0');
assert.deepEqual(botPerspective.ownHand, botInspectionState.secrets.p0.hand);
assert.equal(Object.hasOwn(botPerspective, 'secrets'), false, 'bot view excludes server secrets');
assert.equal(JSON.stringify(botPerspective).includes('p1'), true, 'public opponent identities remain available');
assert.equal(JSON.stringify(botPerspective).includes('d_'), true, 'only the bot\'s own card ids appear in its view');
const observedActor = botInspectionState.currentTurnPlayerId;
const observedLead = getLegalPlays(botInspectionState, observedActor)[0];
({ nextState: botInspectionState } = executeCommand(botInspectionState, { type:'PLAY_SET', playerId:observedActor, ...observedLead }));
const rememberedPlay = getBotPerspective(botInspectionState, 'p0').memory.find((event) => event.type === 'SET_PLAYED');
assert.deepEqual(
  { actorId: rememberedPlay.actorId, rank: rememberedPlay.rank, count: rememberedPlay.count, jesterCount: rememberedPlay.jesterCount },
  { actorId: observedActor, rank: observedLead.rank, count: observedLead.count, jesterCount: observedLead.jesterCount },
  'bots retain the public rank/count/jester details of observed plays',
);

// Leading should value a multi-card dump and its likely next lead, rather
// than greedily choosing an arbitrary singleton.
const planningState = createInitialState(players.slice(0, 4), { useStrippedDeck: false, turnTimeoutSeconds: 0 }, 123);
planningState.matchState = 'PLAYING'; planningState.playPhase = 'TURN_INPUT'; planningState.currentTurnPlayerId = 'p0';
planningState.secrets.p0.hand = [
  { id:'p7a', rank:7 }, { id:'p7b', rank:7 }, { id:'p7c', rank:7 },
  { id:'p4a', rank:4 }, { id:'p4b', rank:4 }, { id:'p11', rank:11 }, { id:'p12', rank:12 },
];
planningState.players.forEach((player) => { player.handCount = player.id === 'p0' ? 7 : 7; });
const plannedLead = chooseBotCommand(planningState, 'p0');
assert.deepEqual(plannedLead, { type:'PLAY_SET', playerId:'p0', rank:7, count:3, jesterCount:0 }, 'bot selects the planned three-card dump as lead');

// Similar expected outcomes should not make an aggressive bot mechanically
// deterministic.  The seeded choice remains reproducible for a given room.
const gamblingChoices = new Set();
for (let seed = 1; seed <= 60; seed += 1) {
  const gamblingState = createInitialState(players.slice(0, 4), { useStrippedDeck:false, turnTimeoutSeconds:0 }, seed);
  gamblingState.matchState = 'PLAYING'; gamblingState.playPhase = 'TURN_INPUT'; gamblingState.currentTurnPlayerId = 'p0';
  gamblingState.players.forEach((player) => { player.handCount = 6; player.botProfile = 'AGGRESSIVE'; });
  gamblingState.secrets.p0.hand = [
    { id:'g8a', rank:8 }, { id:'g8b', rank:8 }, { id:'g9a', rank:9 },
    { id:'g9b', rank:9 }, { id:'g10a', rank:10 }, { id:'g10b', rank:10 },
  ];
  const choice = chooseBotCommand(gamblingState, 'p0');
  gamblingChoices.add(`${choice.rank}x${choice.count}`);
}
assert.ok(gamblingChoices.size >= 2, 'aggressive bots vary among similarly viable leads across deterministic room seeds');

// Passing is temporary: a player remains eligible after somebody else plays.
let playState = createInitialState(players.slice(0, 4), { turnTimeoutSeconds: 0 }, 7);
({ nextState: playState } = executeCommand(playState, { type: 'START_MATCH', playerId: 'p0' }));
while (playState.playPhase !== 'TURN_INPUT') {
  const actor = playState.currentTurnPlayerId;
  ({ nextState: playState } = executeCommand(playState, chooseBotCommand(playState, actor)));
}
const leader = playState.currentTurnPlayerId;
const lead = getLegalPlays(playState, leader)[0];
assert.ok(lead);
({ nextState: playState } = executeCommand(playState, { type: 'PLAY_SET', playerId: leader, ...lead }));
const responder = playState.currentTurnPlayerId;
({ nextState: playState } = executeCommand(playState, { type: 'PASS', playerId: responder }));
assert.ok(playState.trick.passPlayerIds.includes(responder));

// Jokers may fill a numeric set, while the effective numeric rank still has to beat the pile.
const jokerState = createInitialState(players.slice(0, 4), { turnTimeoutSeconds: 0 }, 11);
jokerState.matchState = 'PLAYING'; jokerState.playPhase = 'TURN_INPUT'; jokerState.currentTurnPlayerId = 'p0';
jokerState.trick.requiredCount = 2; jokerState.trick.topRank = 8;
jokerState.secrets.p0.hand = [{ id:'seven', rank:7 }, { id:'joker', rank:13 }, { id:'eight', rank:8 }];
const jokerPlays = getLegalPlays(jokerState, 'p0');
assert.ok(jokerPlays.some((play) => play.rank === 7 && play.count === 2 && play.jesterCount === 1));
assert.equal(jokerPlays.some((play) => play.rank === 8), false);
assert.equal(chooseTimeoutCommand(jokerState, 'p0').type, 'PASS', 'response timeout passes');
jokerState.trick.requiredCount = null; jokerState.trick.topRank = null;
assert.deepEqual(chooseTimeoutCommand(jokerState, 'p0'), { type:'PLAY_SET', playerId:'p0', rank:13, count:1, jesterCount:1 }, 'lead timeout plays weakest singleton');
assert.ok(getLegalPlays(jokerState, 'p0').some((play) => play.rank === 7 && play.count === 2 && play.jesterCount === 1), 'the leader can choose multiple cards with a joker');
const botLead = chooseBotCommand(jokerState, 'p0');
assert.notEqual(botLead.rank, 13, 'bots do not automatically lead with a jester when natural cards exist');

// A Jester is both playable and wild: alone it is rank 13, with a natural
// card it takes that card's rank. The leader may choose either legal set.
let mixedJesterState = createInitialState(players.slice(0, 4), { turnTimeoutSeconds: 0 }, 29);
mixedJesterState.matchState = 'PLAYING'; mixedJesterState.playPhase = 'TURN_INPUT'; mixedJesterState.currentTurnPlayerId = 'p0';
mixedJesterState.secrets.p0.hand = [{ id:'six', rank:6 }, { id:'j1', rank:13 }, { id:'j2', rank:13 }];
({ nextState: mixedJesterState } = executeCommand(mixedJesterState, { type:'PLAY_SET', playerId:'p0', rank:6, count:2, jesterCount:1 }));
assert.equal(mixedJesterState.trick.topRank, 6);
assert.equal(mixedJesterState.trick.requiredCount, 2);
assert.equal(mixedJesterState.trick.sets[0].jesterCount, 1);
let loneJesterState = createInitialState(players.slice(0, 4), { turnTimeoutSeconds: 0 }, 31);
loneJesterState.matchState = 'PLAYING'; loneJesterState.playPhase = 'TURN_INPUT'; loneJesterState.currentTurnPlayerId = 'p0';
loneJesterState.secrets.p0.hand = [{ id:'j1', rank:13 }, { id:'j2', rank:13 }];
({ nextState: loneJesterState } = executeCommand(loneJesterState, { type:'PLAY_SET', playerId:'p0', rank:13, count:2, jesterCount:2 }));
assert.equal(loneJesterState.trick.topRank, 13);
assert.equal(loneJesterState.trick.requiredCount, 2);

// A great revolution is identified before reversing the hierarchy and preserves the declaring actor.
let revolutionState = createInitialState(players.slice(0, 4), { turnTimeoutSeconds: 0 }, 17);
const originalHierarchy = [...revolutionState.hierarchy];
const greatPeon = originalHierarchy.at(-1);
revolutionState.matchState = 'PLAYING'; revolutionState.playPhase = 'REVOLUTION_DECISION'; revolutionState.revolutionCandidateId = greatPeon;
({ nextState: revolutionState } = executeCommand(revolutionState, { type:'DECLARE_REVOLUTION', playerId:greatPeon }));
assert.deepEqual(revolutionState.hierarchy, [...originalHierarchy].reverse());
assert.equal(revolutionState.lastAction.type, 'GREAT_REVOLUTION');
assert.equal(revolutionState.lastAction.actorId, greatPeon);

// Tax cards are the peons' strongest cards and are not exposed by the public snapshot.
let taxState = createInitialState(players.slice(0, 4), { turnTimeoutSeconds: 0 }, 23);
const [greatDalmuti, lesserDalmuti, lesserPeon, greatPeonId] = taxState.hierarchy;
taxState.matchState = 'PLAYING'; taxState.playPhase = 'REVOLUTION_DECISION'; taxState.revolutionCandidateId = greatDalmuti;
taxState.secrets[greatPeonId].hand = [{id:'gp1',rank:1},{id:'gp4',rank:4},{id:'gp9',rank:9},{id:'gpJ',rank:13}];
taxState.secrets[lesserPeon].hand = [{id:'lp2',rank:2},{id:'lp8',rank:8}];
taxState.secrets[greatDalmuti].hand = [{id:'gd10',rank:10},{id:'gd11',rank:11}];
taxState.secrets[lesserDalmuti].hand = [{id:'ld12',rank:12}];
({ nextState: taxState } = executeCommand(taxState, { type:'DECLINE_REVOLUTION', playerId:greatDalmuti }));
assert.deepEqual(taxState.tax.pairs[0].offered.map((card) => card.rank), [1,4]);
assert.equal(taxState.secrets[greatPeonId].hand.some((card) => card.rank === 13), true, 'a Jester is never paid as tax');
assert.deepEqual(taxState.tax.pairs[1].offered.map((card) => card.rank), [2]);
assert.equal(JSON.stringify(getPublicView(taxState)).includes('gp1'), false, 'tax identities remain private');
({ nextState: taxState } = executeCommand(taxState, { type:'SELECT_TAX_RETURN', playerId:greatDalmuti, selection:[{rank:10,count:1},{rank:11,count:1}] }));
const taxResult = executeCommand(taxState, { type:'SELECT_TAX_RETURN', playerId:lesserDalmuti, selection:[{rank:12,count:1}] });
taxState = taxResult.nextState;
assert.equal(taxResult.events[0].type, 'TAX_COMPLETED');
assert.deepEqual(taxState.secrets[greatDalmuti].hand.map((card) => card.rank), [1,4]);
assert.deepEqual(taxState.secrets[greatPeonId].hand.map((card) => card.rank), [9,10,11,13]);

// Seeded matches are reproducible and run through all configured rounds.
let matchA = createInitialState(players.slice(0, 4), { roundCount:5, turnTimeoutSeconds:0 }, 909);
let matchB = createInitialState(players.slice(0, 4), { roundCount:5, turnTimeoutSeconds:0 }, 909);
assert.deepEqual(matchA.hierarchy, matchB.hierarchy);
({ nextState: matchA } = executeCommand(matchA, { type:'START_MATCH', playerId:'p0' }));
let matchGuard = 0;
while (matchA.matchState !== 'GAME_OVER' && matchGuard++ < 30000) {
  const command = matchA.matchState === 'ROUND_END'
    ? { type:'ADVANCE_ROUND', playerId:'p0' }
    : chooseBotCommand(matchA, matchA.currentTurnPlayerId);
  ({ nextState: matchA } = executeCommand(matchA, command));
}
assert.equal(matchA.matchState, 'GAME_OVER');
assert.equal(matchA.roundNumber, 5);
assert.ok(matchA.outcome.winnerIds.length >= 1);

console.log('Dalmuti core rules, simulation, privacy and card conservation passed.');
