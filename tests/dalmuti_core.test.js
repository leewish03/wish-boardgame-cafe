import assert from 'node:assert/strict';
import {
  createDeck, createInitialState, executeCommand, getLegalPlays,
  chooseBotCommand, chooseTimeoutCommand, getPublicView, getPrivateView,
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
assert.equal(createDeck({ useStrippedDeck: true }, 5).length, 68, 'five-player stripped deck has 68 cards');
assert.equal(createDeck({ useStrippedDeck: true }, 4).length, 57, 'four-player stripped deck has 57 cards');

let state = createInitialState(players, { roundCount: 5, firstDealRevolution: false, turnTimeoutSeconds: 0 }, 4242);
({ nextState: state } = executeCommand(state, { type: 'START_MATCH', playerId: 'p0' }));
assert.equal(state.roundNumber, 1);
assert.equal(totalCards(state), 80);
assert.equal(new Set(state.hierarchy).size, players.length, 'rank draw yields a complete hierarchy');

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

// Passing is temporary: a player remains eligible after somebody else plays.
let playState = createInitialState(players.slice(0, 4), { firstDealRevolution: true, turnTimeoutSeconds: 0 }, 7);
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
taxState.secrets[greatPeonId].hand = [{id:'gp1',rank:1},{id:'gp4',rank:4},{id:'gp9',rank:9}];
taxState.secrets[lesserPeon].hand = [{id:'lp2',rank:2},{id:'lp8',rank:8}];
taxState.secrets[greatDalmuti].hand = [{id:'gd10',rank:10},{id:'gd11',rank:11}];
taxState.secrets[lesserDalmuti].hand = [{id:'ld12',rank:12}];
({ nextState: taxState } = executeCommand(taxState, { type:'DECLINE_REVOLUTION', playerId:greatDalmuti }));
assert.deepEqual(taxState.tax.pairs[0].offered.map((card) => card.rank), [1,4]);
assert.deepEqual(taxState.tax.pairs[1].offered.map((card) => card.rank), [2]);
assert.equal(JSON.stringify(getPublicView(taxState)).includes('gp1'), false, 'tax identities remain private');
({ nextState: taxState } = executeCommand(taxState, { type:'SELECT_TAX_RETURN', playerId:greatDalmuti, selection:[{rank:10,count:1},{rank:11,count:1}] }));
const taxResult = executeCommand(taxState, { type:'SELECT_TAX_RETURN', playerId:lesserDalmuti, selection:[{rank:12,count:1}] });
taxState = taxResult.nextState;
assert.equal(taxResult.events[0].type, 'TAX_COMPLETED');
assert.deepEqual(taxState.secrets[greatDalmuti].hand.map((card) => card.rank), [1,4]);
assert.deepEqual(taxState.secrets[greatPeonId].hand.map((card) => card.rank), [9,10,11]);

// Seeded matches are reproducible and run through all configured rounds.
let matchA = createInitialState(players.slice(0, 4), { roundCount:5, firstDealRevolution:true, turnTimeoutSeconds:0 }, 909);
let matchB = createInitialState(players.slice(0, 4), { roundCount:5, firstDealRevolution:true, turnTimeoutSeconds:0 }, 909);
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
