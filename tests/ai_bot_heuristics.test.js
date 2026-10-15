import assert from 'assert';
import fs from 'node:fs';
import { core } from './load_core.js';
const policyUrl = new URL(process.env.AI_POLICY_MODULE || '../server/core/AiBotController.js', import.meta.url);
const { buildBotObservation, createBotKnowledge, createBotPlayer, decideBotAction, observeBotEvents } = await import(policyUrl);

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

const regressions = [];
function check(name, scenario) {
  const started = performance.now();
  try { const detail = scenario(); regressions.push({ name, passed: true, milliseconds: performance.now() - started, detail }); }
  catch (error) { regressions.push({ name, passed: false, milliseconds: performance.now() - started, error: error.message }); }
}
function capture(current, knowledge, seed) {
  const worlds = new Map();
  const action = decideBotAction(buildBotObservation(current, 'bot'), knowledge, {
    executeCommand(sample, command) {
      if (command.type === 'PLAY_CARD' && command.playerId === 'bot') {
        const key = JSON.stringify(command);
        const list = worlds.get(key) || [];
        list.push(structuredClone(sample)); worlds.set(key, list);
      }
      return core.executeCommand(sample, command);
    },
  }, seed);
  return { action, worlds };
}

check('King target remembers its given card; uninvolved observer learns no secret', () => {
  const before = state({ botHand: [card('given', 8)], targetHand: [card('king', 6), card('received', 2)] });
  before.players[1].cardCount = 2; before.players[2].isBot = true;
  before.currentTurnPlayerId = 'target';
  const result = core.executeCommand(before, { type: 'PLAY_CARD', playerId: 'target', cardId: 'king', targetId: 'bot' });
  const room = {}; observeBotEvents(room, before, result.nextState, result.events);
  assert.equal(room.botKnowledgeByPlayerId.bot.beliefsByPlayerId.target.exactValue, 8);
  assert.equal(room.botKnowledgeByPlayerId.other.beliefsByPlayerId.target.exactValue, null);
  return { actorKnownCard: 8, observerKnownCard: null };
});

check('Exact cards reserved, exclusions strict, worlds shared across candidates', () => {
  const current = state(); const knowledge = createBotKnowledge('bot', current);
  knowledge.beliefsByPlayerId.other.exactValue = 8;
  knowledge.beliefsByPlayerId.target.excludedValues = [2, 3, 4, 5, 6, 7, 8];
  knowledge.beliefsByPlayerId.target.probabilities = { 1: 1, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  const { worlds } = capture(current, knowledge, 'constraints');
  assert.ok(worlds.size > 1);
  const first = [...worlds.values()][0];
  for (const samples of worlds.values()) {
    assert.deepEqual(samples, first, 'candidate comparisons must use identical worlds');
    for (const sample of samples) {
      assert.equal(sample.secrets.target.hand[0].value, 1);
      assert.equal(sample.secrets.other.hand[0].value, 8);
      const all = [...Object.values(sample.secrets).flatMap(secret => secret.hand), ...sample.deck];
      assert.equal(all.filter(card => card.value === 8).length, 1);
    }
  }
  return { candidates: worlds.size, samplesPerCandidate: first.length };
});

check('Contradictory exact facts use heuristic fallback without impossible worlds', () => {
  const current = state(); const knowledge = createBotKnowledge('bot', current);
  knowledge.beliefsByPlayerId.target.exactValue = 8; knowledge.beliefsByPlayerId.other.exactValue = 8;
  const result = capture(current, knowledge, 'contradictory');
  assert.equal(result.worlds.size, 0);
  assert.deepEqual(result.action, decideBotAction(buildBotObservation(current, 'bot'), knowledge, null, 'contradictory'));
  return { simulationCalls: 0, fallback: result.action };
});

check('Uninformed samples follow count prior once', () => {
  const current = state(); let guards = 0; let total = 0;
  for (let seed = 0; seed < 50; seed++) {
    const { worlds } = capture(current, createBotKnowledge('bot', current), `prior-${seed}`);
    for (const sample of [...worlds.values()][0]) { total++; guards += Number(sample.secrets.target.hand[0].value === 1); }
  }
  const frequency = guards / total;
  assert.ok(Math.abs(frequency - 4 / 14) < 0.045, `Guard prior ${frequency} must approximate 4/14`);
  return { guards, total, frequency, expected: 4 / 14 };
});

check('Exhausted public ranks cannot be Guard candidates', () => {
  const current = state(); const knowledge = createBotKnowledge('bot', current);
  current.players[2].discardPile = [card('discarded_princess', 8)];
  knowledge.beliefsByPlayerId.target.probabilities = { 8: 0.9, 2: 0.1 };
  const { worlds } = capture(current, knowledge, 'exhausted-rank');
  assert.ok(worlds.size > 0);
  for (const command of worlds.keys()) assert.notEqual(JSON.parse(command).guessValue, 8);
  return { candidateCommands: [...worlds.keys()].map(command => JSON.parse(command)) };
});

check('Core-backed known Princess Prince tactic across fixed seeds', () => {
  const current = state({ botHand: [card('prince', 5), card('maid', 4)] });
  const knowledge = createBotKnowledge('bot', current);
  knowledge.beliefsByPlayerId.target.exactValue = 8;
  const actions = [];
  for (const seed of ['tactic-1', 'tactic-2', 'tactic-3', 'tactic-4']) {
    const action = decideBotAction(buildBotObservation(current, 'bot'), knowledge, core, seed);
    assert.equal(action.cardId, 'prince'); assert.equal(action.targetId, 'target');
    const result = core.executeCommand(current, { type: 'PLAY_CARD', playerId: 'bot', ...action });
    assert.equal(result.nextState.players.find(player => player.id === 'target').isEliminated, true);
    actions.push({ seed, ...action });
  }
  return { actions };
});

check('Sampling reserves singleton facts before unconstrained hands', () => {
  const current = state(); const knowledge = createBotKnowledge('bot', current);
  knowledge.beliefsByPlayerId.other.exactValue = 8;
  let samples = 0;
  for (let seed = 0; seed < 10; seed++) {
    const { worlds } = capture(current, knowledge, `reserve-${seed}`);
    for (const sample of [...worlds.values()][0]) {
      samples++;
      const cards = [...sample.deck, ...Object.values(sample.secrets).flatMap(secret => secret.hand)];
      assert.equal(cards.filter(card => card.value === 8).length, 1);
    }
  }
  return { samples };
});

check('Constrained assignments backtrack instead of violating zero probabilities', () => {
  const current = state(); current.players[2].discardPile = [card('g1', 1), card('g2', 1), card('g3', 1)];
  const knowledge = createBotKnowledge('bot', current);
  knowledge.beliefsByPlayerId.target.probabilities = { 1: 0.999, 2: 0.001 };
  knowledge.beliefsByPlayerId.other.probabilities = { 1: 1 };
  const { worlds } = capture(current, knowledge, 'backtrack');
  assert.ok(worlds.size > 0);
  for (const sample of [...worlds.values()][0]) {
    assert.equal(sample.secrets.target.hand[0].value, 2);
    assert.equal(sample.secrets.other.hand[0].value, 1);
  }
  return { samples: [...worlds.values()][0].length };
});

const policySource = fs.readFileSync(policyUrl, 'utf8');
const { utility: evaluateUtility } = await import(`data:text/javascript;base64,${Buffer.from(`${policySource}\nexport { utility };`).toString('base64')}`);
check('Core terminal showdown loss is negative even while surviving', () => {
  const current = state({ botHand: [card('maid', 4), card('priest', 2)], targetHand: [card('princess', 8)] });
  current.deck = [];
  const played = core.executeCommand(current, { type: 'PLAY_CARD', playerId: 'bot', cardId: 'maid' });
  const terminal = played.nextState.playPhase === 'ACTION_RESOLVING' ? core.executeCommand(played.nextState, { type: 'FINALIZE_ACTION' }).nextState : played.nextState;
  assert.equal(terminal.matchState, 'ROUND_END');
  assert.equal(terminal.players[0].isEliminated, false);
  assert.equal(evaluateUtility(terminal, 'bot'), -1);
  assert.equal(evaluateUtility(terminal, 'target'), 1);
  current.roundWinnerIds = ['bot'];
  assert.ok(evaluateUtility(current, 'bot') < 1, 'nonterminal snapshots cannot receive terminal win utility');
  return { winnerIds: terminal.roundWinnerIds, survivingLoserUtility: evaluateUtility(terminal, 'bot') };
});

check('Guard remains playable when every guess is known to miss', () => {
  const current = state({ botHand: [card('princess', 8), card('guard', 1)] });
  const knowledge = createBotKnowledge('bot', current);
  for (const belief of Object.values(knowledge.beliefsByPlayerId)) {
    belief.exactValue = 1; belief.probabilities = { 1: 1 }; belief.excludedValues = [2, 3, 4, 5, 6, 7, 8];
  }
  const action = decideBotAction(buildBotObservation(current, 'bot'), knowledge, core, 'certain-miss');
  assert.equal(action.cardId, 'guard');
  assert.ok(action.guessValue >= 2 && action.guessValue <= 8);
  core.executeCommand(current, { type: 'PLAY_CARD', playerId: 'bot', ...action });
  return action;
});

check('Match winner overrides tied round winners', () => {
  const current = state(); current.matchState = 'GAME_OVER'; current.roundWinnerIds = ['bot', 'target'];
  current.matchWinnerId = 'target'; current.outcome = { kind: 'MATCH', winnerIds: ['target'] };
  assert.equal(evaluateUtility(current, 'bot'), -1);
  assert.equal(evaluateUtility(current, 'target'), 1);
  return { roundWinners: current.roundWinnerIds, matchWinner: current.matchWinnerId };
});

const evidencePath = 'output/ai-quality/love-letter.json';
fs.mkdirSync('output/ai-quality', { recursive: true });
const priorEvidence = fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath, 'utf8')) : {};
const phase = process.env.AI_EVIDENCE_PHASE || 'after';
fs.writeFileSync(evidencePath, JSON.stringify({ ...priorEvidence, [phase]: { invocation: `${process.env.AI_POLICY_MODULE ? `AI_POLICY_MODULE=${process.env.AI_POLICY_MODULE} AI_EVIDENCE_PHASE=${phase} ` : ''}node tests/ai_bot_heuristics.test.js`, recordedAt: new Date().toISOString(), regressions } }, null, 2));
assert.ok(regressions.every(result => result.passed), JSON.stringify(regressions.filter(result => !result.passed), null, 2));
