import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { core } from '../tests/load_core.js';
import * as activePolicy from '../server/core/AiBotController.js';

const profiles = ['AGGRESSIVE', 'DEFENSIVE', 'CALCULATING', 'STRATEGIC', 'INFORMATIVE'];
const inventory = (count) => count >= 5 ? [7, 3, 3, 3, 3, 1, 1, 1] : [5, 2, 2, 2, 2, 1, 1, 1];
function randomFor(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = Math.imul(value ^ value >>> 15, value | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}
function checkCards(state) {
  const cards = [...state.deck, ...(state.setAsideCard ? [state.setAsideCard] : []),
    ...(state.setAsideOpenCards || []), ...state.players.flatMap(player => player.discardPile),
    ...Object.values(state.secrets).flatMap(secret => secret.hand)];
  assert.deepEqual(inventory(state.players.length), Array.from({ length: 8 }, (_, i) => cards.filter(card => card.value === i + 1).length), 'exact value inventory');
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length, 'unique physical card IDs');
  for (const player of state.players) {
    assert.equal(player.cardCount, state.secrets[player.id].hand.length, 'public hand count');
    if (player.isEliminated) assert.equal(player.cardCount, 0, 'eliminated hand empty');
  }
}

export function verifyLoveLetterMatches({ seeds = 4, policy = activePolicy, strict = true } = {}) {
  assert.ok(Number.isInteger(seeds) && seeds > 0, 'positive integer seed count');
  const savedRandom = Math.random;
  const report = { matches: [], repeatedMatches: 3, simulationCalls: 0, simulationErrors: 0, invalidWorlds: 0, diagnostics: [], fairnessChecks: 0, duplicateEventChecks: 0 };
  const timings = [];
  const simulationCore = {
    executeCommand(state, command) {
      report.simulationCalls++;
      try { checkCards(state); }
      catch (error) {
        report.invalidWorlds++;
        if (report.diagnostics.length < 3) report.diagnostics.push({ kind: 'invalidWorld', message: error.message });
      }
      try { return core.executeCommand(state, command); }
      catch (error) {
        report.simulationErrors++;
        if (report.diagnostics.length < 3) report.diagnostics.push({ kind: 'simulationError', command, message: error.message });
        throw error;
      }
    },
  };
  function match(count, seed) {
    Math.random = randomFor(seed * 100 + count);
    const players = Array.from({ length: count }, (_, i) => ({ id: `bot${i}`, nickname: `Bot ${i}`, isBot: true, personality: profiles[(i + seed) % profiles.length] }));
    let state = core.createInitialGameState(players);
    const room = { botKnowledgeByPlayerId: Object.fromEntries(players.map(player => [player.id, policy.createBotKnowledge(player.id, state)])) };
    const transcript = [];
    let commands = 0;
    let actions = 0;
    function execute(command) {
      assert.ok(++commands <= 1200, 'bounded match termination');
      const result = core.executeCommand(state, command);
      assert.ok(result.nextState.stateVersion > state.stateVersion, 'command makes progress');
      policy.observeBotEvents(room, state, result.nextState, result.events);
      const observed = structuredClone(room.botKnowledgeByPlayerId);
      policy.observeBotEvents(room, state, result.nextState, result.events);
      assert.deepEqual(room.botKnowledgeByPlayerId, observed, 'duplicate event replay idempotence');
      report.duplicateEventChecks++;
      state = result.nextState;
      checkCards(state);
    }
    execute({ type: 'START_MATCH' });
    while (state.matchState !== 'GAME_OVER') {
      if (state.matchState === 'ROUND_END') { execute({ type: 'START_ROUND' }); continue; }
      if (state.playPhase === 'ACTION_RESOLVING') { execute({ type: 'FINALIZE_ACTION' }); continue; }
      if (['ROUND_START', 'TURN_PREPARING'].includes(state.playPhase)) { execute({ type: 'OPEN_TURN', playerId: state.currentTurnPlayerId }); continue; }
      assert.equal(state.playPhase, 'TURN_INPUT');
      const actorId = state.currentTurnPlayerId;
      const observation = policy.buildBotObservation(state, actorId);
      const knowledge = room.botKnowledgeByPlayerId[actorId];
      assert.ok(knowledge, 'persistent production-style knowledge');
      const decisionSeed = `${count}:${seed}:${state.roundNumber}:${state.stateVersion}:${actorId}`;
      const started = performance.now();
      const action = policy.decideBotAction(observation, knowledge, simulationCore, decisionSeed);
      timings.push(performance.now() - started);
      assert.ok(action, 'active player always returns action');
      const legality = core.validatePlayCard(state, actorId, action.cardId, action.targetId, action.guessValue);
      assert.ok(legality.valid, `illegal bot action: ${legality.error}`);
      if (actions % 10 === 0) {
        const alternate = structuredClone(state);
        const hiddenCards = [...alternate.deck, ...(alternate.setAsideCard ? [alternate.setAsideCard] : []), ...Object.entries(alternate.secrets).filter(([id]) => id !== actorId).flatMap(([, secret]) => secret.hand)];
        const values = hiddenCards.map(card => card.value).reverse();
        hiddenCards.forEach((card, index) => { card.value = values[index]; });
        const alternateObservation = policy.buildBotObservation(alternate, actorId);
        assert.deepEqual(alternateObservation, observation, 'hidden state does not enter observation');
        assert.deepEqual(policy.decideBotAction(alternateObservation, structuredClone(knowledge), simulationCore, decisionSeed), action, 'hidden state cannot influence decision');
        report.fairnessChecks++;
      }
      transcript.push({ actorId, cardValue: observation.privateState.hand.find(card => card.id === action.cardId).value, targetId: action.targetId, guessValue: action.guessValue });
      actions++;
      execute({ type: 'PLAY_CARD', playerId: actorId, ...action, deferTransition: true });
    }
    assert.ok(state.players.find(player => player.id === state.matchWinnerId)?.tokens >= state.config.targetTokens);
    assert.deepEqual(room.botKnowledgeByPlayerId, {}, 'match completion clears memory');
    return { players: count, seed, rounds: state.roundNumber, actions, commands, winner: state.matchWinnerId, transcriptHash: createHash('sha256').update(JSON.stringify(transcript)).digest('hex') };
  }
  try {
    for (const count of [2, 4, 6]) {
      for (let seed = 1; seed <= seeds; seed++) report.matches.push(match(count, seed));
      assert.deepEqual(match(count, 1), report.matches.find(result => result.players === count), 'same seed reproduces complete match');
    }
  } finally { Math.random = savedRandom; }
  assert.equal(Math.random, savedRandom, 'global random restored');
  timings.sort((a, b) => a - b);
  report.latency = { includesInventoryAudit: true, decisions: timings.length, p95Ms: timings[Math.floor(timings.length * 0.95)], maxMs: timings.at(-1) };
  assert.ok(report.simulationCalls > 0, 'real active core search was exercised');
  report.strictPassed = report.simulationErrors === 0 && report.invalidWorlds === 0;
  if (strict) assert.ok(report.strictPassed, `invalid simulations: ${JSON.stringify(report)}`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const phase = process.env.AI_EVIDENCE_PHASE || 'after';
  const policy = phase === 'before' ? await import('../.omo/evidence/ai-quality/AiBotController.baseline.mjs') : activePolicy;
  const result = verifyLoveLetterMatches({ seeds: Number(process.env.AI_MATCH_SEEDS || 4), policy, strict: phase !== 'before' });
  const evidencePath = 'output/ai-quality/verification.json';
  fs.mkdirSync('output/ai-quality', { recursive: true });
  const previous = fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath, 'utf8')) : {};
  fs.writeFileSync(evidencePath, JSON.stringify({ ...previous, [phase]: { invocation: `${phase === 'before' ? 'AI_EVIDENCE_PHASE=before ' : ''}node scripts/verify-gameplay-ai.js`, recordedAt: new Date().toISOString(), ...result } }, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
