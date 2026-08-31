import assert from 'assert';
import { core } from '../load_core.js';

const {
  createInitialGameState,
  executeCommand,
  validatePlayCard,
  CARD_DEFINITIONS,
} = core;

console.log('================================================================');
console.log('🧪 Section 47: Love Letter Core Rule Engine 17 Unit Tests');
console.log('================================================================\n');

function createTestState(playersConfig, options = {}) {
  const initialPlayers = playersConfig.map((p, idx) => ({
    id: p.id || `p${idx + 1}`,
    nickname: p.nickname || `Player${idx + 1}`,
    avatar: p.avatar || '👑',
    isHost: idx === 0,
    isBot: false,
  }));

  const state = createInitialGameState(initialPlayers, {
    targetTokens: options.targetTokens || 4,
    turnTimeoutSeconds: 30,
    minPlayers: 2,
    maxPlayers: 6,
    ...options.configOverrides,
  });

  state.matchState = 'PLAYING';
  state.roundNumber = 1;
  state.currentTurnPlayerId = options.turnPlayerId || initialPlayers[0].id;
  state.deck = options.deck !== undefined
    ? [...options.deck]
    : [
        { id: 'd_1', value: 1, name: '경비병' },
        { id: 'd_2', value: 2, name: '사제' },
        { id: 'd_3', value: 3, name: '남작' },
        { id: 'd_4', value: 4, name: '하녀' },
        { id: 'd_5', value: 5, name: '왕자' },
      ];
  state.setAsideCard = options.setAsideCard || { id: 'c_aside', value: 1, name: '경비병' };

  playersConfig.forEach((p, idx) => {
    const id = p.id || `p${idx + 1}`;
    const player = state.players.find((pl) => pl.id === id);
    if (player) {
      player.tokens = p.tokens || 0;
      player.isEliminated = !!p.isEliminated;
      player.isProtected = !!p.isProtected;
      player.discardPile = p.discardPile ? [...p.discardPile] : [];
      player.cardCount = (p.hand || []).length;
    }
    state.secrets[id] = {
      id,
      hand: p.hand ? [...p.hand] : [],
    };
  });

  return state;
}

// 1. Guard 성공 (올바른 추측 → 탈락)
console.log('▶ [1/17] Guard (1) Successful Snipe -> Target Eliminated');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_guard_1', value: 1, name: '경비병' }, { id: 'c_handmaid', value: 4, name: '하녀' }] },
    { id: 'p2', hand: [{ id: 'c_priest', value: 2, name: '사제' }] },
    { id: 'p3', hand: [{ id: 'c_baron', value: 3, name: '남작' }] },
  ]);

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_guard_1',
    targetId: 'p2',
    guessValue: 2,
  });

  const p2 = nextState.players.find((p) => p.id === 'p2');
  assert.strictEqual(p2.isEliminated, true, 'Player 2 must be eliminated on correct Guard guess');
  assert.strictEqual(p2.cardCount, 0, 'Eliminated player hand count must be 0');
  assert.strictEqual(nextState.secrets['p2'].hand.length, 0, 'Eliminated player secret hand must be empty');
  assert.strictEqual(nextState.lastAction.resultType, 'GUARD_SUCCESS');
  assert.ok(events.some((e) => e.type === 'GUARD_SUCCEEDED' && e.targetId === 'p2'));
  assert.ok(events.some((e) => e.type === 'PLAYER_ELIMINATED' && e.playerId === 'p2'));
  console.log('   ✅ Guard successfully eliminated target on correct guess (Priest = 2).\n');
}

// 2. Guard 실패 (잘못된 추측 → 안전)
console.log('▶ [2/17] Guard (1) Failed Guess -> Target Safe');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_guard_1', value: 1, name: '경비병' }, { id: 'c_handmaid', value: 4, name: '하녀' }] },
    { id: 'p2', hand: [{ id: 'c_priest', value: 2, name: '사제' }] },
    { id: 'p3', hand: [{ id: 'c_baron', value: 3, name: '남작' }] },
  ]);

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_guard_1',
    targetId: 'p2',
    guessValue: 5,
  });

  const p2 = nextState.players.find((p) => p.id === 'p2');
  assert.strictEqual(p2.isEliminated, false, 'Player 2 must survive incorrect Guard guess');
  assert.ok(nextState.secrets['p2'].hand.some((c) => c.value === 2), 'Player 2 Priest card must remain intact in hand');
  assert.strictEqual(nextState.lastAction.resultType, 'GUARD_FAILED');
  assert.ok(events.some((e) => e.type === 'GUARD_FAILED' && e.targetId === 'p2'));
  console.log('   ✅ Guard guess failed safely (guessed Prince 5 on Priest 2).\n');
}

// 3. Guard 1 추측 금지
console.log('▶ [3/17] Guard (1) Prohibits Guessing Value 1 (Guard)');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_guard_1', value: 1, name: '경비병' }, { id: 'c_priest', value: 2, name: '사제' }] },
    { id: 'p2', hand: [{ id: 'c_baron', value: 3, name: '남작' }] },
  ]);

  const val1 = validatePlayCard(state, 'p1', 'c_guard_1', 'p2', 1);
  assert.strictEqual(val1.valid, false, 'Guard guessing value 1 must be invalid');
  assert.ok(val1.error.includes('2번(사제)부터 8번(공주)'), 'Validation error must explain range');

  assert.throws(() => {
    executeCommand(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: 'c_guard_1',
      targetId: 'p2',
      guessValue: 1,
    });
  }, /경비병은 2번/, 'Executing Guard guessing 1 must throw an error');
  console.log('   ✅ Guard 1-guess restriction is strictly validated and rejected.\n');
}

// 4. Priest (시전자에게만 카드 공개)
console.log('▶ [4/17] Priest (2) Secretly Reveals Target Hand to Actor Only');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_priest_1', value: 2, name: '사제' }, { id: 'c_guard', value: 1, name: '경비병' }] },
    { id: 'p2', hand: [{ id: 'c_princess', value: 8, name: '공주' }] },
    { id: 'p3', hand: [{ id: 'c_king', value: 6, name: '국왕' }] },
  ]);

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_priest_1',
    targetId: 'p2',
  });

  const p2 = nextState.players.find((p) => p.id === 'p2');
  assert.strictEqual(p2.isEliminated, false, 'Player 2 is not eliminated by Priest');
  assert.ok(nextState.secrets['p2'].hand.some((c) => c.value === 8), 'Player 2 keeps Princess');
  assert.ok(nextState.lastAction.resultType === 'PRIEST_REVEAL' || nextState.lastAction.resultType === 'PRIEST_PEEK', 'ResultType must be PRIEST_REVEAL or PRIEST_PEEK');
  assert.strictEqual(nextState.lastAction.revealedCard.value, 8);

  const priestEv = events.find((e) => e.type === 'PRIEST_REVEALED');
  assert.ok(priestEv, 'PRIEST_REVEALED event must be emitted');
  assert.strictEqual(priestEv.actorId, 'p1');
  assert.strictEqual(priestEv.targetId, 'p2');
  assert.strictEqual(priestEv.revealedCard.value, 8);
  console.log('   ✅ Priest secretly revealed target hand card without altering game state.\n');
}

// 5. Baron 승리 (높은 카드 승)
console.log('▶ [5/17] Baron (3) Duel Victory -> Lower Card Player Eliminated');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_baron_1', value: 3, name: '남작' }, { id: 'c_prince', value: 5, name: '왕자' }] },
    { id: 'p2', hand: [{ id: 'c_priest', value: 2, name: '사제' }] },
    { id: 'p3', hand: [{ id: 'c_guard', value: 1, name: '경비병' }] },
  ]);

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_baron_1',
    targetId: 'p2',
  });

  const p1 = nextState.players.find((p) => p.id === 'p1');
  const p2 = nextState.players.find((p) => p.id === 'p2');
  assert.strictEqual(p1.isEliminated, false, 'Actor holding 5 wins Baron duel');
  assert.strictEqual(p2.isEliminated, true, 'Target holding 2 loses Baron duel and is eliminated');
  assert.strictEqual(nextState.lastAction.resultType, 'BARON_WIN');
  assert.ok(events.some((e) => e.type === 'BARON_COMPARED' && e.winnerId === 'p1' && e.eliminatedId === 'p2'));
  console.log('   ✅ Baron duel victory: Player 1 (Prince 5) beat Player 2 (Priest 2).\n');
}

// 6. Baron 패배 (낮은 카드 탈락)
console.log('▶ [6/17] Baron (3) Duel Loss -> Lower Card Actor Eliminated');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_baron_1', value: 3, name: '남작' }, { id: 'c_guard', value: 1, name: '경비병' }] },
    { id: 'p2', hand: [{ id: 'c_king', value: 6, name: '국왕' }] },
    { id: 'p3', hand: [{ id: 'c_prince', value: 5, name: '왕자' }] },
  ]);

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_baron_1',
    targetId: 'p2',
  });

  const p1 = nextState.players.find((p) => p.id === 'p1');
  const p2 = nextState.players.find((p) => p.id === 'p2');
  assert.strictEqual(p1.isEliminated, true, 'Actor holding 1 loses Baron duel and is eliminated');
  assert.strictEqual(p2.isEliminated, false, 'Target holding 6 survives');
  assert.ok(nextState.lastAction.resultType === 'BARON_LOSE' || nextState.lastAction.resultType === 'BARON_LOSS', 'ResultType must indicate Baron loss');
  assert.ok(events.some((e) => e.type === 'BARON_COMPARED' && e.winnerId === 'p2' && e.eliminatedId === 'p1'));
  console.log('   ✅ Baron duel loss: Player 1 (Guard 1) eliminated against Player 2 (King 6).\n');
}

// 7. Baron 무승부 (동일 값)
console.log('▶ [7/17] Baron (3) Tie -> Neither Player Eliminated');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_baron_1', value: 3, name: '남작' }, { id: 'c_handmaid_1', value: 4, name: '하녀' }] },
    { id: 'p2', hand: [{ id: 'c_handmaid_2', value: 4, name: '하녀' }] },
    { id: 'p3', hand: [{ id: 'c_prince', value: 5, name: '왕자' }] },
  ]);

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_baron_1',
    targetId: 'p2',
  });

  const p1 = nextState.players.find((p) => p.id === 'p1');
  const p2 = nextState.players.find((p) => p.id === 'p2');
  assert.strictEqual(p1.isEliminated, false, 'Player 1 survives Baron tie');
  assert.strictEqual(p2.isEliminated, false, 'Player 2 survives Baron tie');
  assert.strictEqual(nextState.lastAction.resultType, 'BARON_TIE');
  assert.ok(events.some((e) => e.type === 'BARON_COMPARED' && !e.winnerId));
  console.log('   ✅ Baron tie: Both players held Handmaid (4), neither eliminated.\n');
}

// 8. Handmaid (보호 상태 설정 및 면역)
console.log('▶ [8/17] Handmaid (4) Protection State & Immunity Validation');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_handmaid_1', value: 4, name: '하녀' }, { id: 'c_priest', value: 2, name: '사제' }] },
    { id: 'p2', hand: [{ id: 'c_guard_1', value: 1, name: '경비병' }] },
    { id: 'p3', hand: [{ id: 'c_baron', value: 3, name: '남작' }] },
  ]);

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_handmaid_1',
  });

  const p1 = nextState.players.find((p) => p.id === 'p1');
  assert.strictEqual(p1.isProtected, true, 'Player 1 must be protected by Handmaid');
  assert.strictEqual(nextState.lastAction.resultType, 'HANDMAID_PROTECT');
  assert.ok(events.some((e) => e.type === 'HANDMAID_PROTECTED' && e.actorId === 'p1'));

  // Player 2 attempts to target Player 1 with Guard -> must fail
  nextState.currentTurnPlayerId = 'p2';
  const valGuard = validatePlayCard(nextState, 'p2', nextState.secrets['p2'].hand[0].id, 'p1', 2);
  assert.strictEqual(valGuard.valid, false, 'Targeting protected player must be rejected');
  assert.ok(valGuard.error.includes('보호'), 'Error message must specify Handmaid protection');

  // Verify Handmaid protection clears on Player 1's next turn action
  nextState.currentTurnPlayerId = 'p1';
  const { nextState: stateAfterTurn } = executeCommand(nextState, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_priest',
    targetId: 'p3',
  });
  const p1After = stateAfterTurn.players.find((p) => p.id === 'p1');
  assert.strictEqual(p1After.isProtected, false, 'Protection must be removed when player acts on next turn');
  console.log('   ✅ Handmaid protection successfully blocks attacks and resets on next turn.\n');
}

// 9. Prince self-target (자기 카드 버리고 새로 드로우)
console.log('▶ [9/17] Prince (5) Self-Target -> Discard Hand & Draw Replacement');
{
  const state = createTestState(
    [
      { id: 'p1', hand: [{ id: 'c_prince_1', value: 5, name: '왕자' }, { id: 'c_guard_1', value: 1, name: '경비병' }] },
      { id: 'p2', hand: [{ id: 'c_priest', value: 2, name: '사제' }] },
    ],
    {
      deck: [{ id: 'c_baron_repl', value: 3, name: '남작' }],
    }
  );

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_prince_1',
    targetId: 'p1',
  });

  const p1 = nextState.players.find((p) => p.id === 'p1');
  assert.strictEqual(p1.isEliminated, false, 'Player 1 is not eliminated');
  assert.strictEqual(p1.discardPile.length, 2, 'Player 1 discarded Prince and Guard');
  assert.strictEqual(p1.discardPile[1].value, 1, 'Discarded card is Guard(1)');
  assert.strictEqual(nextState.secrets['p1'].hand.length, 1, 'Player 1 hand count is 1');
  assert.strictEqual(nextState.secrets['p1'].hand[0].id, 'c_baron_repl', 'Player 1 drew replacement card Baron(3)');
  assert.ok(events.some((e) => e.type === 'PRINCE_DISCARDED' && e.targetId === 'p1'));
  console.log('   ✅ Prince self-target correctly discarded Guard(1) and drew new card.\n');
}

// 10. Prince → Princess 즉시 탈락
console.log('▶ [10/17] Prince (5) Forcing Princess (8) Discard -> Instant Elimination');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_prince_1', value: 5, name: '왕자' }, { id: 'c_guard', value: 1, name: '경비병' }] },
    { id: 'p2', hand: [{ id: 'c_princess', value: 8, name: '공주' }] },
    { id: 'p3', hand: [{ id: 'c_priest', value: 2, name: '사제' }] },
  ]);

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_prince_1',
    targetId: 'p2',
  });

  const p2 = nextState.players.find((p) => p.id === 'p2');
  assert.strictEqual(p2.isEliminated, true, 'Player 2 must be eliminated when Princess is discarded');
  assert.strictEqual(p2.discardPile.some((c) => c.value === 8), true, 'Princess must be in discard pile');
  assert.strictEqual(nextState.lastAction.resultType, 'PRINCE_PRINCESS_ELIMINATED');
  assert.ok(events.some((e) => e.type === 'PLAYER_ELIMINATED' && e.playerId === 'p2'));
  console.log('   ✅ Prince targeting Princess correctly triggered instant elimination.\n');
}

// 11. King swap (카드 맞교환)
console.log('▶ [11/17] King (6) Hand Swap Between Actor and Target');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_king_1', value: 6, name: '국왕' }, { id: 'c_priest', value: 2, name: '사제' }] },
    { id: 'p2', hand: [{ id: 'c_prince', value: 5, name: '왕자' }] },
    { id: 'p3', hand: [{ id: 'c_guard', value: 1, name: '경비병' }] },
  ]);

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_king_1',
    targetId: 'p2',
  });

  assert.strictEqual(nextState.secrets['p1'].hand[0].id, 'c_prince', 'Player 1 received Prince (5)');
  assert.ok(nextState.secrets['p2'].hand.some((c) => c.id === 'c_priest'), 'Player 2 received Priest (2)');
  assert.strictEqual(nextState.lastAction.resultType, 'KING_SWAP');
  assert.strictEqual(nextState.lastAction.swapped, true);
  assert.ok(events.some((e) => e.type === 'HANDS_SWAPPED' && e.actorId === 'p1' && e.targetId === 'p2'));
  console.log('   ✅ King swap successfully traded hands between Player 1 and Player 2.\n');
}

// 12. Countess forced (왕자/국왕 보유 시 강제 제출)
console.log('▶ [12/17] Countess (7) Forced Play Constraint with Prince (5) / King (6)');
{
  // Holding Countess + Prince
  const statePrince = createTestState([
    { id: 'p1', hand: [{ id: 'c_countess', value: 7, name: '백작부인' }, { id: 'c_prince', value: 5, name: '왕자' }] },
    { id: 'p2', hand: [{ id: 'c_guard', value: 1, name: '경비병' }] },
  ]);

  const valPrince = validatePlayCard(statePrince, 'p1', 'c_prince', 'p2');
  assert.strictEqual(valPrince.valid, false, 'Playing Prince while holding Countess must be blocked');
  assert.ok(valPrince.error.includes('백작부인(7)'));

  const valCountessP = validatePlayCard(statePrince, 'p1', 'c_countess');
  assert.strictEqual(valCountessP.valid, true, 'Playing Countess must be allowed');

  // Holding Countess + King
  const stateKing = createTestState([
    { id: 'p1', hand: [{ id: 'c_countess', value: 7, name: '백작부인' }, { id: 'c_king', value: 6, name: '국왕' }] },
    { id: 'p2', hand: [{ id: 'c_guard', value: 1, name: '경비병' }] },
  ]);

  const valKing = validatePlayCard(stateKing, 'p1', 'c_king', 'p2');
  assert.strictEqual(valKing.valid, false, 'Playing King while holding Countess must be blocked');

  const valCountessK = validatePlayCard(stateKing, 'p1', 'c_countess');
  assert.strictEqual(valCountessK.valid, true, 'Playing Countess must be allowed');
  console.log('   ✅ Countess forced play rule verified for both Prince(5) and King(6).\n');
}

// 13. Princess self elimination (공주 직접 사용 시 탈락)
console.log('▶ [13/17] Princess (8) Self-Play -> Instant Self Elimination');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_princess', value: 8, name: '공주' }, { id: 'c_guard', value: 1, name: '경비병' }] },
    { id: 'p2', hand: [{ id: 'c_priest', value: 2, name: '사제' }] },
    { id: 'p3', hand: [{ id: 'c_baron', value: 3, name: '남작' }] },
  ]);

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_princess',
  });

  const p1 = nextState.players.find((p) => p.id === 'p1');
  assert.strictEqual(p1.isEliminated, true, 'Player 1 must be eliminated for playing Princess');
  assert.ok(nextState.lastAction.resultType === 'PRINCESS_SELF_ELIMINATED' || nextState.lastAction.resultType === 'PRINCESS_ELIMINATED', 'ResultType must indicate Princess elimination');
  assert.ok(events.some((e) => e.type === 'PLAYER_ELIMINATED' && e.playerId === 'p1'));
  console.log('   ✅ Princess self-play caused instant elimination of actor.\n');
}

// 14. 전원 Handmaid 보호 시 대상 없음 처리 (Fizzle / Target None)
console.log('▶ [14/17] All Opponents Protected by Handmaid -> Safe Fizzle with No Target');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_guard_1', value: 1, name: '경비병' }, { id: 'c_priest', value: 2, name: '사제' }] },
    { id: 'p2', isProtected: true, hand: [{ id: 'c_baron', value: 3, name: '남작' }] },
    { id: 'p3', isProtected: true, hand: [{ id: 'c_king', value: 6, name: '국왕' }] },
  ]);

  // Validate play Guard with no target when all opponents are protected
  const val = validatePlayCard(state, 'p1', 'c_guard_1', undefined);
  assert.strictEqual(val.valid, true, 'Playing targeted card with no valid targets must be valid');

  const { nextState } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_guard_1',
  });

  const p1 = nextState.players.find((p) => p.id === 'p1');
  const p2 = nextState.players.find((p) => p.id === 'p2');
  const p3 = nextState.players.find((p) => p.id === 'p3');

  assert.strictEqual(p1.isEliminated, false);
  assert.strictEqual(p2.isEliminated, false);
  assert.strictEqual(p3.isEliminated, false);
  assert.strictEqual(p1.discardPile.some((c) => c.id === 'c_guard_1'), true);
  console.log('   ✅ Target-requiring card fizzled safely without target when all opponents protected.\n');
}

// 15. Last survivor → round winner
console.log('▶ [15/17] Last Survivor -> Instant Round Victory');
{
  const state = createTestState([
    { id: 'p1', hand: [{ id: 'c_baron', value: 3, name: '남작' }, { id: 'c_king', value: 6, name: '국왕' }] },
    { id: 'p2', isEliminated: true, hand: [] },
    { id: 'p3', hand: [{ id: 'c_guard', value: 1, name: '경비병' }] },
  ]);

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_baron',
    targetId: 'p3',
  });

  assert.strictEqual(nextState.matchState, 'ROUND_END', 'Match state must transition to ROUND_END');
  assert.deepStrictEqual(nextState.roundWinnerIds, ['p1'], 'Last survivor p1 must be round winner');
  const p1 = nextState.players.find((p) => p.id === 'p1');
  assert.strictEqual(p1.tokens, 1, 'Winner tokens must increase by 1');
  assert.ok(events.some((e) => e.type === 'ROUND_ENDED' && e.winnerIds.includes('p1')));
  console.log('   ✅ Sole survivor immediately won the round and received an affection token.\n');
}

// 16. Deck exhaustion → 남은 플레이어 중 최고 카드 승
console.log('▶ [16/17] Deck Exhaustion -> Highest Card Value Wins (Tie-Break by Discard Sum)');
{
  // 16-1: Clear highest card
  const stateEmptyDeck = createTestState(
    [
      { id: 'p1', hand: [{ id: 'c_handmaid', value: 4, name: '하녀' }, { id: 'c_priest', value: 2, name: '사제' }] },
      { id: 'p2', hand: [{ id: 'c_king', value: 6, name: '국왕' }] },
      { id: 'p3', hand: [{ id: 'c_baron', value: 3, name: '남작' }] },
    ],
    { deck: [] }
  );

  const { nextState } = executeCommand(stateEmptyDeck, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_handmaid',
  });

  assert.strictEqual(nextState.matchState, 'ROUND_END', 'Exhausted deck must trigger ROUND_END');
  assert.deepStrictEqual(nextState.roundWinnerIds, ['p2'], 'Player 2 holding King(6) must win');
  const p2 = nextState.players.find((p) => p.id === 'p2');
  assert.strictEqual(p2.tokens, 1);

  // 16-2: Tie-break discard sum
  const stateTie = createTestState(
    [
      { id: 'p1', hand: [{ id: 'c_countess', value: 7, name: '백작부인' }, { id: 'c_king_1', value: 6, name: '국왕' }], discardPile: [{ value: 5 }, { value: 4 }] }, // discard sum = 9 + 7 = 16
      { id: 'p2', hand: [{ id: 'c_king_2', value: 6, name: '국왕' }], discardPile: [{ value: 2 }, { value: 1 }] }, // discard sum = 3
    ],
    { deck: [] }
  );

  const { nextState: stateTieResult } = executeCommand(stateTie, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_countess',
  });

  assert.strictEqual(stateTieResult.matchState, 'ROUND_END');
  assert.deepStrictEqual(stateTieResult.roundWinnerIds, ['p1'], 'Player 1 wins tie-break with higher discard sum');
  console.log('   ✅ Deck exhaustion correctly evaluated highest card and discard sum tie-breaker.\n');
}

// 17. Match victory (필요 토큰 도달)
console.log('▶ [17/17] Match Victory -> Target Tokens Reached -> GAME_OVER');
{
  const state = createTestState(
    [
      { id: 'p1', tokens: 1, hand: [{ id: 'c_baron', value: 3, name: '남작' }, { id: 'c_prince', value: 5, name: '왕자' }] },
      { id: 'p2', tokens: 0, hand: [{ id: 'c_guard', value: 1, name: '경비병' }] },
    ],
    {
      configOverrides: { targetTokens: 2 },
    }
  );

  const { nextState, events } = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_baron',
    targetId: 'p2',
  });

  assert.strictEqual(nextState.matchState, 'GAME_OVER', 'Match state must be GAME_OVER');
  assert.strictEqual(nextState.matchWinnerId, 'p1', 'Player 1 must be match winner');
  const p1 = nextState.players.find((p) => p.id === 'p1');
  assert.strictEqual(p1.tokens, 2, 'Player 1 has 2 tokens');
  assert.ok(events.some((e) => e.type === 'MATCH_ENDED' && e.matchWinnerId === 'p1'));
  console.log('   ✅ Match reached target tokens (2), declared Player 1 champion with GAME_OVER.\n');
}

console.log('================================================================');
console.log('🎉 ALL 17 LOVE LETTER CORE UNIT TESTS PASSED WITH 100% ACCURACY!');
console.log('================================================================\n');
