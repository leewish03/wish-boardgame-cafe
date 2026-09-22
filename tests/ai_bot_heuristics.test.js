import assert from 'assert';
import { core } from './load_core.js';
import { buildBotObservation, createBotKnowledge, createBotPlayer, decideBotAction, observeBotEvents } from '../server/core/AiBotController.js';

const card = (id, value) => ({ id, value, name: ['','경비병','사제','남작','하녀','왕자','국왕','백작부인','공주'][value] });
const player = (id, isBot = false) => ({ id, nickname: id, avatar: '👤', tokens: 0, isReady: true, isHost: id === 'bot', isBot, isEliminated: false, isProtected: false, cardCount: 1, discardPile: [], personality: isBot ? 'CALCULATING' : undefined });

function state({ botHand = [card('guard', 1), card('maid', 4)], targetHand = [card('target_card', 8)], otherHand = [card('other_card', 2)] } = {}) {
  const players = [player('bot', true), player('target'), player('other')];
  players[0].cardCount = botHand.length;
  return {
    matchState: 'PLAYING', playPhase: 'TURN_INPUT', roundNumber: 1,
    config: { targetTokens: 3, turnTimeoutSeconds: 30, maxPlayers: 6, minPlayers: 2 },
    players, secrets: { bot: { id: 'bot', hand: botHand }, target: { id: 'target', hand: targetHand }, other: { id: 'other', hand: otherHand } },
    deck: [card('deck_1', 1), card('deck_2', 3), card('deck_3', 5)], setAsideCard: null, setAsideOpenCards: [],
    currentTurnPlayerId: 'bot', turnStartedAt: 0, turnExpiresAt: 0, lastAction: null, stateVersion: 10,
    matchWinnerId: null, roundWinnerIds: [], outcome: null,
  };
}

console.log('🧪 Active Love Letter AI policy tests');

{
  const bot = createBotPlayer([]);
  assert.equal(bot.isBot, true);
  assert.equal(bot.memory, undefined);
  assert.ok(bot.personality);
}

{
  const before = state();
  const after = structuredClone(before);
  after.secrets.bot.hand = [card('guard', 1), card('maid', 4)];
  const room = {};
  observeBotEvents(room, before, after, [{ type: 'PRIEST_USED', actionId: 'priest_1', actorId: 'bot', targetId: 'target', revealedCard: card('target_card', 8) }]);
  const knowledge = room.botKnowledgeByPlayerId.bot;
  assert.equal(knowledge.beliefsByPlayerId.target.exactValue, 8);
  const action = decideBotAction(buildBotObservation(after, 'bot'), knowledge, core, 'priest-snipe');
  assert.equal(action.cardId, 'guard');
  assert.equal(action.targetId, 'target');
  assert.equal(action.guessValue, 8);
}

{
  const current = state({ targetHand: [card('target_card', 3)] });
  const room = {};
  observeBotEvents(room, current, current, [{ type: 'GUARD_FAILED', actionId: 'guard_1', actorId: 'other', targetId: 'target', guessValue: 2 }]);
  const knowledge = room.botKnowledgeByPlayerId.bot;
  assert.ok(knowledge.beliefsByPlayerId.target.excludedValues.includes(2));
  const action = decideBotAction(buildBotObservation(current, 'bot'), knowledge, core, 'failed-guard');
  assert.notEqual(action.guessValue, 2, 'same hand revision must not repeat a public failed Guard guess');
}

{
  const current = state({ botHand: [card('countess', 7), card('king', 6)] });
  const action = decideBotAction(buildBotObservation(current, 'bot'), createBotKnowledge('bot', current), core, 'forced-countess');
  assert.equal(action.cardId, 'countess');
}

{
  const current = state({ botHand: [card('princess', 8), card('guard', 1)] });
  const action = decideBotAction(buildBotObservation(current, 'bot'), createBotKnowledge('bot', current), core, 'keep-princess');
  assert.equal(action.cardId, 'guard');
}

{
  const first = state({ targetHand: [card('secret_a', 8)] });
  const second = state({ targetHand: [card('secret_b', 2)] });
  const firstObservation = buildBotObservation(first, 'bot');
  const secondObservation = buildBotObservation(second, 'bot');
  assert.deepEqual(firstObservation, secondObservation, 'opponent secrets must not enter the observation');
  const firstAction = decideBotAction(firstObservation, createBotKnowledge('bot', first), core, 'same-public-view');
  const secondAction = decideBotAction(secondObservation, createBotKnowledge('bot', second), core, 'same-public-view');
  assert.deepEqual(firstAction, secondAction, 'same public facts and seed must produce same decision');
}

console.log('✅ Active AI remembers private Priest facts, avoids repeated Guard misses, honors forced rules, and receives no opponent secrets.');
