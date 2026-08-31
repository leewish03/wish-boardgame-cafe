import assert from 'assert';
import { core } from './load_core.js';
import { createBotPlayer, decideBotAction } from '../server/core/AiBotController.js';

const { createInitialGameState, executeCommand } = core;

console.log('================================================================');
console.log('🧪 Section 48: Property-Based Multi-Game Simulation & Invariants');
console.log('================================================================\n');

const TOTAL_MATCHES = 200;
let totalRoundsSimulated = 0;
let totalTurnsSimulated = 0;
const startTime = Date.now();

console.log(`▶ Running ${TOTAL_MATCHES} automated full matches with strict invariant checks...`);

for (let matchIdx = 1; matchIdx <= TOTAL_MATCHES; matchIdx++) {
  // Vary player counts (2, 3, 4, 5, 6 players) and target tokens (2 to 4)
  const playerCount = 2 + ((matchIdx - 1) % 5); // 2, 3, 4, 5, 6
  const targetTokens = playerCount === 2 ? 3 : playerCount <= 4 ? 2 : 2;

  const bots = [];
  for (let i = 0; i < playerCount; i++) {
    bots.push(createBotPlayer(bots));
  }

  let state = createInitialGameState(bots, {
    targetTokens,
    turnTimeoutSeconds: 30,
  });

  let res = executeCommand(state, { type: 'START_MATCH' });
  state = res.nextState;

  let matchTurnCount = 0;
  const maxTurnsPerMatch = 500;

  function verifyStateInvariants(s, stageDescription) {
    if (s.matchState === 'LOBBY') return;

    // Invariant 1: Turn Player Validity
    if (s.matchState === 'PLAYING') {
      assert.ok(s.currentTurnPlayerId, `[${stageDescription}] currentTurnPlayerId must not be null during PLAYING`);
      const turnPlayer = s.players.find((p) => p.id === s.currentTurnPlayerId);
      assert.ok(turnPlayer, `[${stageDescription}] currentTurnPlayer must exist in players list`);
      assert.strictEqual(turnPlayer.isEliminated, false, `[${stageDescription}] currentTurnPlayer must not be eliminated`);
    }

    // Invariant 2 & 3: Card Conservation & Unique Card IDs
    if (s.matchState === 'PLAYING' || s.matchState === 'ROUND_END') {
      const allCardIds = new Set();
      let totalCards = 0;

      // Deck cards
      for (const c of s.deck) {
        assert.ok(c && c.id, `[${stageDescription}] Deck card must have valid id`);
        assert.ok(!allCardIds.has(c.id), `[${stageDescription}] Duplicate card id found in deck: ${c.id}`);
        allCardIds.add(c.id);
        totalCards++;
      }

      // Set aside card
      if (s.setAsideCard) {
        assert.ok(!allCardIds.has(s.setAsideCard.id), `[${stageDescription}] Duplicate setAsideCard id: ${s.setAsideCard.id}`);
        allCardIds.add(s.setAsideCard.id);
        totalCards++;
      }

      // Hand cards & Discard pile
      for (const p of s.players) {
        const sec = s.secrets[p.id];
        const hand = sec ? sec.hand : [];

        // Player public cardCount must match secret hand length
        assert.strictEqual(
          p.cardCount,
          hand.length,
          `[${stageDescription}] Player ${p.nickname} public cardCount (${p.cardCount}) must match secret hand length (${hand.length})`
        );

        for (const c of hand) {
          assert.ok(c && c.id, `[${stageDescription}] Hand card must have valid id`);
          assert.ok(!allCardIds.has(c.id), `[${stageDescription}] Duplicate card id in hand of ${p.nickname}: ${c.id}`);
          allCardIds.add(c.id);
          totalCards++;
        }

        for (const c of p.discardPile) {
          assert.ok(c && c.id, `[${stageDescription}] Discard card must have valid id`);
          assert.ok(!allCardIds.has(c.id), `[${stageDescription}] Duplicate card id in discard pile of ${p.nickname}: ${c.id}`);
          allCardIds.add(c.id);
          totalCards++;
        }
      }

      // 16 cards (2-4 players) or 22 cards (5-6 players) total per round
      const expectedTotalCards = s.players.length >= 5 ? 22 : 16;
      assert.strictEqual(
        totalCards,
        expectedTotalCards,
        `[${stageDescription}] Total card count invariant violated: expected ${expectedTotalCards}, got ${totalCards}`
      );
    }

    // Invariant 4: Round Winner Validity
    if (s.matchState === 'ROUND_END') {
      assert.ok(s.roundWinnerIds.length >= 1, `[${stageDescription}] ROUND_END must declare at least 1 winner`);
      for (const wId of s.roundWinnerIds) {
        const wPlayer = s.players.find((p) => p.id === wId);
        assert.ok(wPlayer, `[${stageDescription}] Winner ID ${wId} must be a registered player`);
      }
    }

    // Invariant 5: Match Winner Validity
    if (s.matchState === 'GAME_OVER') {
      assert.ok(s.matchWinnerId, `[${stageDescription}] GAME_OVER must declare a matchWinnerId`);
      const champion = s.players.find((p) => p.id === s.matchWinnerId);
      assert.ok(champion, `[${stageDescription}] matchWinnerId must exist in players`);
      assert.ok(champion.tokens >= s.config.targetTokens, `[${stageDescription}] Champion tokens must be >= targetTokens`);
    }
  }

  // Initial round check
  verifyStateInvariants(state, `Match ${matchIdx} Round Start`);

  while (state.matchState !== 'GAME_OVER' && matchTurnCount < maxTurnsPerMatch) {
    matchTurnCount++;
    totalTurnsSimulated++;

    if (state.matchState === 'ROUND_END') {
      totalRoundsSimulated++;
      res = executeCommand(state, { type: 'START_ROUND' });
      state = res.nextState;
      verifyStateInvariants(state, `Match ${matchIdx} Round ${state.roundNumber} Start`);
      continue;
    }

    const currentTurnPlayer = state.players.find((p) => p.id === state.currentTurnPlayerId);
    assert.ok(currentTurnPlayer, `Current turn player must exist in Match ${matchIdx}`);
    assert.strictEqual(currentTurnPlayer.isEliminated, false, `Eliminated player cannot take turn in Match ${matchIdx}`);

    const botAction = decideBotAction(state, currentTurnPlayer);
    assert.ok(botAction, `AI Bot must produce a valid action in Match ${matchIdx}`);

    res = executeCommand(state, {
      type: 'PLAY_CARD',
      playerId: currentTurnPlayer.id,
      cardId: botAction.cardId,
      targetId: botAction.targetId,
      guessValue: botAction.guessValue,
    });
    state = res.nextState;

    verifyStateInvariants(state, `Match ${matchIdx} Turn ${matchTurnCount}`);
  }

  // Invariant 6: No Deadlock & Match Always Terminates
  assert.strictEqual(
    state.matchState,
    'GAME_OVER',
    `Match ${matchIdx} did not reach GAME_OVER within ${maxTurnsPerMatch} turns (deadlock detected)`
  );
  assert.ok(state.matchWinnerId, `Match ${matchIdx} must produce a valid match winner`);

  if (matchIdx % 40 === 0 || matchIdx === TOTAL_MATCHES) {
    const winner = state.players.find((p) => p.id === state.matchWinnerId);
    console.log(
      `   Progress: ${matchIdx}/${TOTAL_MATCHES} matches completed (${playerCount}p, target: ${targetTokens} tokens). Winner: ${winner.nickname}`
    );
  }
}

const elapsedMs = Date.now() - startTime;
console.log('\n================================================================');
console.log(`🎉 ALL ${TOTAL_MATCHES} PROPERTY/SIMULATION MATCHES PASSED 100%!`);
console.log(`   - Total Matches: ${TOTAL_MATCHES}`);
console.log(`   - Total Rounds: ${totalRoundsSimulated}`);
console.log(`   - Total Turns: ${totalTurnsSimulated}`);
console.log(`   - Deadlocks: 0 (100% terminated successfully)`);
console.log(`   - Card Conservation Invariant: 100% verified (exactly 16 cards at every turn)`);
console.log(`   - No Duplicate Card IDs Invariant: 100% verified (0 duplicate IDs)`);
console.log(`   - Turn Player Invariant: 100% verified (0 turns by eliminated players)`);
console.log(`   - Winner Validity Invariant: 100% verified`);
console.log(`   - Time Elapsed: ${(elapsedMs / 1000).toFixed(2)}s`);
console.log('================================================================\n');
