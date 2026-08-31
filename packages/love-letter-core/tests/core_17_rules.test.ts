import assert from 'assert';
import {
  createInitialGameState,
  resolveCommand,
  validatePlayCard,
  getValidTargets,
  getPlayableCards,
  isRoundOver,
  isMatchOver,
  determineRoundWinners,
  GameState,
  CardInstance,
} from '../src/index';

console.log('🧪 Starting 17 Love Letter Core Pure TypeScript Unit Tests...\n');

function helperCreate2PState(
  p1Hand: CardInstance[],
  p2Hand: CardInstance[],
  deckCards: CardInstance[] = [],
  p1Discards: CardInstance[] = [],
  p2Discards: CardInstance[] = []
): GameState {
  const state = createInitialGameState([
    { id: 'p1', nickname: 'Alice', isHost: true },
    { id: 'p2', nickname: 'Bob', isHost: false },
  ]);
  state.matchState = 'PLAYING';
  state.playPhase = 'TURN_INPUT';
  state.currentTurnPlayerId = 'p1';
  state.roundNumber = 1;
  state.secrets['p1'] = { id: 'p1', hand: p1Hand };
  state.secrets['p2'] = { id: 'p2', hand: p2Hand };
  state.players[0].cardCount = p1Hand.length;
  state.players[1].cardCount = p2Hand.length;
  state.players[0].discardPile = p1Discards;
  state.players[1].discardPile = p2Discards;
  state.deck = deckCards;
  state.setAsideCard = { id: 'c_secret', value: 1, name: '경비병' };
  return state;
}

// --------------------------------------------------------------------------
// 1. Guard Success Test
// --------------------------------------------------------------------------
console.log('▶ Test 1: Guard (1) Correct Guess (Success -> Target Eliminated)');
{
  const state = helperCreate2PState(
    [{ id: 'c_guard', value: 1, name: '경비병' }],
    [{ id: 'c_priest', value: 2, name: '사제' }],
    [{ id: 'c_deck', value: 4, name: '하녀' }]
  );

  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_guard',
    targetId: 'p2',
    guessValue: 2,
  });

  const bob = nextState.players.find(p => p.id === 'p2')!;
  assert.strictEqual(bob.isEliminated, true, 'Bob should be eliminated on correct guess');
  assert.strictEqual(nextState.secrets['p2'].hand.length, 0, 'Bob hand should be emptied');
  assert.strictEqual(bob.discardPile.some(c => c.value === 2), true, 'Bob card should move to discard');
  assert.ok(events.some(e => e.type === 'GUARD_SUCCESS'), 'GUARD_SUCCESS event must be emitted');
  assert.ok(events.some(e => e.type === 'PLAYER_ELIMINATED' && e.playerId === 'p2'), 'PLAYER_ELIMINATED event emitted');
  console.log('  ✅ Test 1 Passed: Guard correctly eliminates target upon matching guess.\n');
}

// --------------------------------------------------------------------------
// 2. Guard Failure Test
// --------------------------------------------------------------------------
console.log('▶ Test 2: Guard (1) Incorrect Guess (Failure -> Target Survives)');
{
  const state = helperCreate2PState(
    [{ id: 'c_guard', value: 1, name: '경비병' }],
    [{ id: 'c_priest', value: 2, name: '사제' }],
    [{ id: 'c_deck', value: 4, name: '하녀' }]
  );

  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_guard',
    targetId: 'p2',
    guessValue: 3, // Wrong guess
  });

  const bob = nextState.players.find(p => p.id === 'p2')!;
  assert.strictEqual(bob.isEliminated, false, 'Bob should survive wrong guess');
  assert.strictEqual(nextState.secrets['p2'].hand.length, 2, 'Bob should have his card plus turn draw');
  assert.ok(events.some(e => e.type === 'GUARD_FAILED'), 'GUARD_FAILED event must be emitted');
  console.log('  ✅ Test 2 Passed: Guard failure leaves target unharmed and advances turn.\n');
}

// --------------------------------------------------------------------------
// 3. Priest Test
// --------------------------------------------------------------------------
console.log('▶ Test 3: Priest (2) Secret Hand Peek');
{
  const state = helperCreate2PState(
    [{ id: 'c_priest_play', value: 2, name: '사제' }, { id: 'c_guard_keep', value: 1, name: '경비병' }],
    [{ id: 'c_king', value: 6, name: '국왕' }],
    [{ id: 'c_deck', value: 4, name: '하녀' }]
  );

  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_priest_play',
    targetId: 'p2',
  });

  const bob = nextState.players.find(p => p.id === 'p2')!;
  assert.strictEqual(bob.isEliminated, false, 'Target should not be eliminated by Priest');
  const priestEvt = events.find(e => e.type === 'PRIEST_USED' || e.type === 'PRIEST_REVEALED') as any;
  assert.ok(priestEvt, 'PRIEST_USED event must be emitted');
  assert.strictEqual(priestEvt.revealedCard.value, 6, 'Revealed card must be Bob King (6)');
  console.log('  ✅ Test 3 Passed: Priest accurately reveals target card.\n');
}

// --------------------------------------------------------------------------
// 4. Baron Win Test
// --------------------------------------------------------------------------
console.log('▶ Test 4: Baron (3) Win (Attacker > Target -> Target Eliminated)');
{
  const state = helperCreate2PState(
    [{ id: 'c_baron', value: 3, name: '남작' }, { id: 'c_prince', value: 5, name: '왕자' }],
    [{ id: 'c_priest', value: 2, name: '사제' }],
    [{ id: 'c_deck', value: 4, name: '하녀' }]
  );

  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_baron',
    targetId: 'p2',
  });

  const alice = nextState.players.find(p => p.id === 'p1')!;
  const bob = nextState.players.find(p => p.id === 'p2')!;
  assert.strictEqual(alice.isEliminated, false, 'Alice (5) should survive');
  assert.strictEqual(bob.isEliminated, true, 'Bob (2) should be eliminated by Baron duel');
  assert.ok(events.some(e => (e.type === 'BARON_DUEL_STARTED' || e.type === 'BARON_COMPARED') && (e as any).winnerId === 'p1'), 'Baron winner must be p1');
  console.log('  ✅ Test 4 Passed: Baron duel eliminates lower card player (Target).\n');
}

// --------------------------------------------------------------------------
// 5. Baron Loss Test
// --------------------------------------------------------------------------
console.log('▶ Test 5: Baron (3) Loss (Attacker < Target -> Attacker Eliminated)');
{
  const state = helperCreate2PState(
    [{ id: 'c_baron', value: 3, name: '남작' }, { id: 'c_guard', value: 1, name: '경비병' }],
    [{ id: 'c_prince', value: 5, name: '왕자' }],
    [{ id: 'c_deck', value: 4, name: '하녀' }]
  );

  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_baron',
    targetId: 'p2',
  });

  const alice = nextState.players.find(p => p.id === 'p1')!;
  const bob = nextState.players.find(p => p.id === 'p2')!;
  assert.strictEqual(alice.isEliminated, true, 'Alice (1) should be eliminated by Bob (5)');
  assert.strictEqual(bob.isEliminated, false, 'Bob (5) should survive');
  assert.ok(events.some(e => e.type === 'PLAYER_ELIMINATED' && e.playerId === 'p1'), 'Alice eliminated event emitted');
  console.log('  ✅ Test 5 Passed: Baron duel eliminates lower card player (Attacker).\n');
}

// --------------------------------------------------------------------------
// 6. Baron Tie Test
// --------------------------------------------------------------------------
console.log('▶ Test 6: Baron (3) Tie (Attacker == Target -> Neither Eliminated)');
{
  const state = helperCreate2PState(
    [{ id: 'c_baron', value: 3, name: '남작' }, { id: 'c_prince_1', value: 5, name: '왕자' }],
    [{ id: 'c_prince_2', value: 5, name: '왕자' }],
    [{ id: 'c_deck', value: 4, name: '하녀' }]
  );

  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_baron',
    targetId: 'p2',
  });

  const alice = nextState.players.find(p => p.id === 'p1')!;
  const bob = nextState.players.find(p => p.id === 'p2')!;
  assert.strictEqual(alice.isEliminated, false, 'Alice should survive tie');
  assert.strictEqual(bob.isEliminated, false, 'Bob should survive tie');
  assert.ok(events.some(e => (e.type === 'BARON_DUEL_STARTED' || e.type === 'BARON_COMPARED') && (e as any).isTie), 'Baron tie flag emitted');
  console.log('  ✅ Test 6 Passed: Baron duel with equal values results in a safe tie.\n');
}

// --------------------------------------------------------------------------
// 7. Handmaid Protection Test
// --------------------------------------------------------------------------
console.log('▶ Test 7: Handmaid (4) Protection (Immunity from targeted cards)');
{
  const state = createInitialGameState([
    { id: 'p1', nickname: 'Alice', isHost: true },
    { id: 'p2', nickname: 'Bob', isHost: false },
    { id: 'p3', nickname: 'Charlie', isHost: false },
  ]);
  state.matchState = 'PLAYING';
  state.currentTurnPlayerId = 'p1';
  state.secrets['p1'] = { id: 'p1', hand: [{ id: 'c_guard', value: 1, name: '경비병' }] };
  state.secrets['p2'] = { id: 'p2', hand: [{ id: 'c_priest', value: 2, name: '사제' }] };
  state.secrets['p3'] = { id: 'p3', hand: [{ id: 'c_baron', value: 3, name: '남작' }] };
  state.players[1].isProtected = true; // Bob is protected by Handmaid

  // Valid targets for Guard should only be Charlie (p3)
  const validTargets = getValidTargets(state, 'p1', 1);
  assert.deepStrictEqual(validTargets, ['p3'], 'Protected Bob (p2) must not be in valid targets');

  // Attempting to target Bob directly must fail validation
  const validation = validatePlayCard(state, 'p1', 'c_guard', 'p2', 2);
  assert.strictEqual(validation.valid, false, 'Targeting protected player must be rejected');

  console.log('  ✅ Test 7 Passed: Handmaid immunity is strictly enforced.\n');
}

// --------------------------------------------------------------------------
// 8. Prince Self-Target Test
// --------------------------------------------------------------------------
console.log('▶ Test 8: Prince (5) Self-Target (Discards Hand & Draws Replacement)');
{
  const state = helperCreate2PState(
    [{ id: 'c_prince', value: 5, name: '왕자' }, { id: 'c_baron', value: 3, name: '남작' }],
    [{ id: 'c_guard', value: 1, name: '경비병' }],
    [{ id: 'c_bob_draw', value: 4, name: '하녀' }, { id: 'c_alice_replacement', value: 2, name: '사제' }]
  );

  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_prince',
    targetId: 'p1', // Alice targets herself
  });

  const alice = nextState.players.find(p => p.id === 'p1')!;
  assert.strictEqual(alice.isEliminated, false, 'Alice remains alive after self-target');
  assert.strictEqual(alice.discardPile.some(c => c.value === 3), true, 'Baron (3) was discarded');
  assert.strictEqual(nextState.secrets['p1'].hand.some(c => c.id === 'c_alice_replacement'), true, 'Alice drew replacement card');
  assert.ok(events.some(e => e.type === 'PRINCE_DISCARDED' && e.targetId === 'p1'), 'PRINCE_DISCARDED event emitted');
  console.log('  ✅ Test 8 Passed: Prince self-targeting discards hand and draws new card.\n');
}

// --------------------------------------------------------------------------
// 9. Prince Princess Elimination Test
// --------------------------------------------------------------------------
console.log('▶ Test 9: Prince (5) Discarding Princess (8) Instant Elimination');
{
  const state = helperCreate2PState(
    [{ id: 'c_prince', value: 5, name: '왕자' }, { id: 'c_guard', value: 1, name: '경비병' }],
    [{ id: 'c_princess', value: 8, name: '공주' }],
    [{ id: 'c_deck', value: 2, name: '사제' }]
  );

  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_prince',
    targetId: 'p2',
  });

  const bob = nextState.players.find(p => p.id === 'p2')!;
  assert.strictEqual(bob.isEliminated, true, 'Bob discarding Princess must be immediately eliminated');
  assert.ok(events.some(e => e.type === 'PLAYER_ELIMINATED' && e.playerId === 'p2'), 'Bob elimination event emitted');
  console.log('  ✅ Test 9 Passed: Forcing Princess discard via Prince instantly eliminates victim.\n');
}

// --------------------------------------------------------------------------
// 10. King Swap Test
// --------------------------------------------------------------------------
console.log('▶ Test 10: King (6) Hands Swap');
{
  const state = helperCreate2PState(
    [{ id: 'c_king', value: 6, name: '국왕' }, { id: 'c_guard', value: 1, name: '경비병' }],
    [{ id: 'c_countess', value: 7, name: '백작부인' }],
    [{ id: 'c_deck', value: 2, name: '사제' }]
  );

  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_king',
    targetId: 'p2',
  });

  const aliceHand = nextState.secrets['p1'].hand;
  // Bob received Alice's Guard(1) and then drew deck card (Priest 2) on his turn
  const bobHand = nextState.secrets['p2'].hand;

  assert.strictEqual(aliceHand[0].value, 7, 'Alice now holds Countess (7) from Bob');
  assert.strictEqual(bobHand.some(c => c.value === 1), true, 'Bob holds Guard (1) from Alice');
  assert.ok(events.some(e => e.type === 'KING_SWAP' || e.type === 'HANDS_SWAPPED'), 'KING_SWAP event emitted');
  console.log('  ✅ Test 10 Passed: King accurately swaps hands between players.\n');
}

// --------------------------------------------------------------------------
// 11. Countess Forced Rule Test
// --------------------------------------------------------------------------
console.log('▶ Test 11: Countess (7) Forced Play when holding Prince (5) or King (6)');
{
  const state = helperCreate2PState(
    [{ id: 'c_countess', value: 7, name: '백작부인' }, { id: 'c_prince', value: 5, name: '왕자' }],
    [{ id: 'c_guard', value: 1, name: '경비병' }]
  );

  // 1. Trying to play Prince while holding Countess -> Must be rejected!
  const valPrince = validatePlayCard(state, 'p1', 'c_prince', 'p2');
  assert.strictEqual(valPrince.valid, false, 'Playing Prince with Countess must be invalid');

  // 2. Playable cards selector should return only Countess
  const playable = getPlayableCards(state, 'p1');
  assert.strictEqual(playable.length, 1, 'Only 1 playable card');
  assert.strictEqual(playable[0].value, 7, 'Playable card must be Countess (7)');

  // 3. Playing Countess -> Must be valid!
  const valCountess = validatePlayCard(state, 'p1', 'c_countess');
  assert.strictEqual(valCountess.valid, true, 'Playing Countess must be valid');

  console.log('  ✅ Test 11 Passed: Countess forced constraint is strictly validated.\n');
}

// --------------------------------------------------------------------------
// 12. Princess Self Elimination Test
// --------------------------------------------------------------------------
console.log('▶ Test 12: Princess (8) Self-Play Elimination');
{
  const state = helperCreate2PState(
    [{ id: 'c_princess', value: 8, name: '공주' }, { id: 'c_guard', value: 1, name: '경비병' }],
    [{ id: 'c_priest', value: 2, name: '사제' }],
    [{ id: 'c_deck', value: 4, name: '하녀' }]
  );

  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_princess',
  });

  const alice = nextState.players.find(p => p.id === 'p1')!;
  assert.strictEqual(alice.isEliminated, true, 'Alice playing Princess must be eliminated');
  assert.ok(events.some(e => e.type === 'PLAYER_ELIMINATED' && e.playerId === 'p1'), 'PLAYER_ELIMINATED emitted for Alice');
  console.log('  ✅ Test 12 Passed: Playing Princess directly causes immediate self-elimination.\n');
}

// --------------------------------------------------------------------------
// 13. All Players Handmaid Scenario (Fizzle Safe)
// --------------------------------------------------------------------------
console.log('▶ Test 13: All Opponents Protected by Handmaid (Safe Fizzle)');
{
  const state = createInitialGameState([
    { id: 'p1', nickname: 'Alice', isHost: true },
    { id: 'p2', nickname: 'Bob', isHost: false },
    { id: 'p3', nickname: 'Charlie', isHost: false },
  ]);
  state.matchState = 'PLAYING';
  state.currentTurnPlayerId = 'p1';
  state.secrets['p1'] = { id: 'p1', hand: [{ id: 'c_guard', value: 1, name: '경비병' }, { id: 'c_priest', value: 2, name: '사제' }] };
  state.secrets['p2'] = { id: 'p2', hand: [{ id: 'c_baron', value: 3, name: '남작' }] };
  state.secrets['p3'] = { id: 'p3', hand: [{ id: 'c_king', value: 6, name: '국왕' }] };
  state.players[1].isProtected = true;
  state.players[2].isProtected = true;
  state.deck = [{ id: 'c_deck', value: 4, name: '하녀' }];

  // Guard has 0 valid opponents
  const validTargets = getValidTargets(state, 'p1', 1);
  assert.strictEqual(validTargets.length, 0, 'No valid targets for Guard when all opponents protected');

  // Playing Guard without target must succeed and fizzle safely
  const val = validatePlayCard(state, 'p1', 'c_guard');
  assert.strictEqual(val.valid, true, 'Playing Guard when no targets exist is valid');

  const { nextState } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_guard',
  });

  assert.strictEqual(nextState.players.find(p => p.id === 'p1')!.isEliminated, false, 'Alice survives');
  assert.strictEqual(nextState.players.find(p => p.id === 'p2')!.isEliminated, false, 'Bob survives');
  assert.strictEqual(nextState.players.find(p => p.id === 'p3')!.isEliminated, false, 'Charlie survives');
  console.log('  ✅ Test 13 Passed: Targeted cards fizzle safely when all opponents are protected.\n');
}

// --------------------------------------------------------------------------
// 14. Last Survivor Round Victory Test
// --------------------------------------------------------------------------
console.log('▶ Test 14: Last Survivor Round Victory');
{
  const state = createInitialGameState([
    { id: 'p1', nickname: 'Alice', isHost: true },
    { id: 'p2', nickname: 'Bob', isHost: false },
    { id: 'p3', nickname: 'Charlie', isHost: false },
  ]);
  state.matchState = 'PLAYING';
  state.currentTurnPlayerId = 'p1';
  state.secrets['p1'] = { id: 'p1', hand: [{ id: 'c_guard', value: 1, name: '경비병' }] };
  state.secrets['p2'] = { id: 'p2', hand: [{ id: 'c_priest', value: 2, name: '사제' }] };
  state.secrets['p3'] = { id: 'p3', hand: [] };
  state.players[2].isEliminated = true; // Charlie already eliminated
  state.deck = [{ id: 'c_deck', value: 4, name: '하녀' }];

  // Alice eliminates Bob -> Only Alice remains alive
  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_guard',
    targetId: 'p2',
    guessValue: 2,
  });

  assert.strictEqual(nextState.matchState, 'ROUND_END', 'Round must end immediately');
  assert.deepStrictEqual(nextState.roundWinnerIds, ['p1'], 'Alice is the sole round winner');
  assert.strictEqual(nextState.players.find(p => p.id === 'p1')!.tokens, 1, 'Alice receives 1 affection token');
  assert.ok(events.some(e => e.type === 'ROUND_ENDED'), 'ROUND_ENDED event emitted');
  console.log('  ✅ Test 14 Passed: Last survivor immediately wins the round.\n');
}

// --------------------------------------------------------------------------
// 15. Deck Exhaustion Round Victory Test
// --------------------------------------------------------------------------
console.log('▶ Test 15: Deck Exhaustion Round Victory (Highest Hand Value Wins)');
{
  const state = helperCreate2PState(
    [{ id: 'c_handmaid', value: 4, name: '하녀' }, { id: 'c_prince', value: 5, name: '왕자' }],
    [{ id: 'c_princess', value: 8, name: '공주' }],
    [] // Empty deck!
  );

  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_handmaid',
  });

  assert.strictEqual(nextState.matchState, 'ROUND_END', 'Round ends on deck exhaustion');
  assert.deepStrictEqual(nextState.roundWinnerIds, ['p2'], 'Bob with Princess (8) beats Alice Prince (5)');
  assert.strictEqual(nextState.players.find(p => p.id === 'p2')!.tokens, 1, 'Bob awarded 1 token');
  console.log('  ✅ Test 15 Passed: Player with highest hand card wins on deck exhaustion.\n');
}

// --------------------------------------------------------------------------
// 16. Discard Pile Tie-Break Test
// --------------------------------------------------------------------------
console.log('▶ Test 16: Deck Exhaustion Discard Pile Tie-Break');
{
  // Alice hand: Prince (5), discard sum: Guard(1) + Handmaid(4) = 5
  // Bob hand: Prince (5), discard sum: King(6) + Priest(2) = 8
  const state = helperCreate2PState(
    [{ id: 'c_handmaid_play', value: 4, name: '하녀' }, { id: 'c_prince_1', value: 5, name: '왕자' }],
    [{ id: 'c_prince_2', value: 5, name: '왕자' }],
    [], // Empty deck
    [{ id: 'c_guard_d', value: 1, name: '경비병' }],
    [{ id: 'c_king_d', value: 6, name: '국왕' }, { id: 'c_priest_d', value: 2, name: '사제' }]
  );

  const { nextState } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_handmaid_play',
  });

  assert.strictEqual(nextState.matchState, 'ROUND_END', 'Round ends on deck exhaustion');
  // Alice discard sum = 1 + 4 = 5. Bob discard sum = 6 + 2 = 8.
  assert.deepStrictEqual(nextState.roundWinnerIds, ['p2'], 'Bob wins discard tie-break with higher sum (8 > 5)');
  assert.strictEqual(nextState.players.find(p => p.id === 'p2')!.tokens, 1, 'Bob awarded 1 token');
  console.log('  ✅ Test 16 Passed: Discard pile sum correctly resolves hand value ties.\n');
}

// --------------------------------------------------------------------------
// 17. Round Token & Match Victory Test
// --------------------------------------------------------------------------
console.log('▶ Test 17: Match Victory on Reaching Target Tokens');
{
  const state = helperCreate2PState(
    [{ id: 'c_guard', value: 1, name: '경비병' }],
    [{ id: 'c_priest', value: 2, name: '사제' }],
    [{ id: 'c_deck', value: 4, name: '하녀' }]
  );
  state.config.targetTokens = 2;
  state.players[0].tokens = 1; // Alice already has 1 token, this will be her 2nd
  state.players[1].tokens = 0;

  const { nextState, events } = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_guard',
    targetId: 'p2',
    guessValue: 2,
  });

  assert.strictEqual(nextState.matchState, 'GAME_OVER', 'Match state must become GAME_OVER');
  assert.strictEqual(nextState.matchWinnerId, 'p1', 'Alice is crowned match champion');
  assert.strictEqual(nextState.players.find(p => p.id === 'p1')!.tokens, 2, 'Alice has 2 tokens');
  assert.ok(events.some(e => e.type === 'MATCH_ENDED' && e.matchWinnerId === 'p1'), 'MATCH_ENDED event emitted');
  console.log('  ✅ Test 17 Passed: Match victory correctly transitions game to GAME_OVER.\n');
}

console.log('🎉 ALL 17 LOVE LETTER CORE UNIT TESTS PASSED WITH 100% ACCURACY!\n');
