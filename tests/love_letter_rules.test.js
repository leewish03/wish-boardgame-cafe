import assert from 'assert';
import {
  generateDeck,
  executePlayCard,
  startRound,
  CARD_DEFS,
} from '../server/games/love-letter.js';

console.log('🧪 Starting Love Letter Rule Engine Unit Tests...\n');

// Mock IO
const mockIo = {
  to: () => ({ emit: () => {} }),
};

// 1. Deck Generation Test
console.log('▶ Test 1: Deck Generation (2~4 players and 5~6 players)');
{
  const deck4 = generateDeck(4);
  assert.strictEqual(deck4.length, 16, '4-player deck must contain exactly 16 cards');

  const deck6 = generateDeck(6);
  assert.strictEqual(deck6.length, 22, '6-player deck must contain 22 cards');

  const guardCount = deck4.filter((c) => c.value === 1).length;
  assert.strictEqual(guardCount, 5, '4-player deck must have 5 Guards');

  const princessCount = deck4.filter((c) => c.value === 8).length;
  assert.strictEqual(princessCount, 1, 'Deck must have exactly 1 Princess');
  console.log('  ✅ Test 1 Passed: Deck counts match standard Love Letter rules.\n');
}

// 2. Countess Constraint Test
console.log('▶ Test 2: Countess (7) Constraint with Prince (5) & King (6)');
{
  const room = {
    code: 'TEST01',
    gameState: 'PLAYING',
    turnPlayerId: 'user_1',
    players: [
      {
        id: 'user_1',
        nickname: 'Alice',
        hand: [
          { id: 'c_prince', value: 5, name: '왕자' },
          { id: 'c_countess', value: 7, name: '백작부인' },
        ],
        discardPile: [],
        isEliminated: false,
        isProtected: false,
      },
      {
        id: 'user_2',
        nickname: 'Bob',
        hand: [{ id: 'c_guard', value: 1, name: '경비병' }],
        discardPile: [],
        isEliminated: false,
        isProtected: false,
      },
    ],
    deck: [{ id: 'c_priest', value: 2, name: '사제' }],
    actionLogs: [],
  };

  // Attempt to play Prince while holding Countess -> must be rejected!
  const resPrince = executePlayCard(mockIo, room, 'user_1', {
    cardId: 'c_prince',
    targetUserId: 'user_2',
  });
  assert.strictEqual(resPrince.success, false, 'Playing Prince with Countess must be blocked');

  // Playing Countess -> must succeed!
  const resCountess = executePlayCard(mockIo, room, 'user_1', {
    cardId: 'c_countess',
  });
  assert.strictEqual(resCountess.success, true, 'Playing Countess must succeed');
  console.log('  ✅ Test 2 Passed: Countess constraint is strictly enforced.\n');
}

// 3. Guard Snipe Test
console.log('▶ Test 3: Guard (1) Target Guessing');
{
  const room = {
    code: 'TEST02',
    gameState: 'PLAYING',
    turnPlayerId: 'user_1',
    players: [
      {
        id: 'user_1',
        nickname: 'Alice',
        hand: [{ id: 'c_guard', value: 1, name: '경비병' }],
        discardPile: [],
        isEliminated: false,
        isProtected: false,
      },
      {
        id: 'user_2',
        nickname: 'Bob',
        hand: [{ id: 'c_priest', value: 2, name: '사제' }],
        discardPile: [],
        isEliminated: false,
        isProtected: false,
      },
    ],
    deck: [{ id: 'c_baron', value: 3, name: '남작' }],
    actionLogs: [],
  };

  // Alice guesses Bob has Baron (3) -> Wrong! Bob survives
  const resWrong = executePlayCard(mockIo, room, 'user_1', {
    cardId: 'c_guard',
    targetUserId: 'user_2',
    guessValue: 3,
  });
  assert.strictEqual(resWrong.success, true);
  assert.strictEqual(room.players[1].isEliminated, false, 'Bob should survive incorrect guess');

  // Reset Alice with Guard, guess Priest (2) -> Correct! Bob eliminated
  room.turnPlayerId = 'user_1';
  room.players[0].hand = [{ id: 'c_guard_2', value: 1, name: '경비병' }];
  const resCorrect = executePlayCard(mockIo, room, 'user_1', {
    cardId: 'c_guard_2',
    targetUserId: 'user_2',
    guessValue: 2,
  });
  assert.strictEqual(resCorrect.success, true);
  assert.strictEqual(room.players[1].isEliminated, true, 'Bob should be eliminated on correct guess');
  console.log('  ✅ Test 3 Passed: Guard accurately eliminates target on correct guess.\n');
}

// 4. Baron Duel Test
console.log('▶ Test 4: Baron (3) Card Duel');
{
  const room = {
    code: 'TEST03',
    gameState: 'PLAYING',
    turnPlayerId: 'user_1',
    players: [
      {
        id: 'user_1',
        nickname: 'Alice',
        hand: [
          { id: 'c_baron', value: 3, name: '남작' },
          { id: 'c_prince', value: 5, name: '왕자' },
        ],
        discardPile: [],
        isEliminated: false,
        isProtected: false,
      },
      {
        id: 'user_2',
        nickname: 'Bob',
        hand: [{ id: 'c_priest', value: 2, name: '사제' }],
        discardPile: [],
        isEliminated: false,
        isProtected: false,
      },
    ],
    deck: [{ id: 'c_card', value: 1, name: '경비병' }],
    actionLogs: [],
  };

  // Alice (holding Prince 5) vs Bob (holding Priest 2) -> Bob eliminated
  executePlayCard(mockIo, room, 'user_1', {
    cardId: 'c_baron',
    targetUserId: 'user_2',
  });
  assert.strictEqual(room.players[1].isEliminated, true, 'Bob (2) should lose to Alice (5)');
  assert.strictEqual(room.players[0].isEliminated, false, 'Alice should survive Baron duel');
  console.log('  ✅ Test 4 Passed: Baron duel correctly eliminates lower value hand.\n');
}

// 5. Prince Discard Princess Instant Elimination Test
console.log('▶ Test 5: Prince (5) Discarding Princess (8) Instant Elimination');
{
  const room = {
    code: 'TEST04',
    gameState: 'PLAYING',
    turnPlayerId: 'user_1',
    players: [
      {
        id: 'user_1',
        nickname: 'Alice',
        hand: [
          { id: 'c_prince', value: 5, name: '왕자' },
          { id: 'c_guard', value: 1, name: '경비병' },
        ],
        discardPile: [],
        isEliminated: false,
        isProtected: false,
      },
      {
        id: 'user_2',
        nickname: 'Bob',
        hand: [{ id: 'c_princess', value: 8, name: '공주' }],
        discardPile: [],
        isEliminated: false,
        isProtected: false,
      },
    ],
    deck: [{ id: 'c_card', value: 1, name: '경비병' }],
    actionLogs: [],
  };

  // Alice plays Prince targeting Bob who has Princess -> Bob eliminated immediately!
  executePlayCard(mockIo, room, 'user_1', {
    cardId: 'c_prince',
    targetUserId: 'user_2',
  });
  assert.strictEqual(room.players[1].isEliminated, true, 'Bob should be eliminated when Princess is discarded');
  console.log('  ✅ Test 5 Passed: Discarding Princess via Prince instantly eliminates player.\n');
}

// 6. 2-Player Round Start Deck Setup Test (No 3-card open removal)
console.log('▶ Test 6: 2-Player Round Start (Unified 1 secret card set aside, 0 open cards)');
{
  const room = {
    code: 'TEST06',
    hostId: 'user_1',
    gameState: 'LOBBY',
    players: [
      { id: 'user_1', nickname: 'Alice', isReady: true, hand: [], discardPile: [] },
      { id: 'user_2', nickname: 'Bob', isReady: true, hand: [], discardPile: [] },
    ],
    deck: [],
    roundNumber: 1,
    targetTokens: 4,
    actionLogs: [],
  };

  startRound(mockIo, room);

  assert.strictEqual(room.setAsideOpenCards.length, 0, '2-player game must NOT set aside 3 open cards');
  assert(room.setAsideSecretCard !== null, '1 secret card must be set aside');
  assert.strictEqual(room.players[0].hand.length, 2, 'Turn player (Alice) draws 1 card, total hand 2');
  assert.strictEqual(room.players[1].hand.length, 1, 'Non-turn player (Bob) starts with hand 1');
  assert.strictEqual(room.deck.length, 12, 'Deck should have 16 - 1 (secret) - 2 (Alice) - 1 (Bob) = 12 cards');
  console.log('  ✅ Test 6 Passed: 2-player mode correctly uses unified deck setup without 3 open cards.\n');
}

// 7. Structured Action Detail Verification Test
console.log('▶ Test 7: Structured Action Detail Payload Verification');
{
  const room = {
    code: 'TEST07',
    gameState: 'PLAYING',
    turnPlayerId: 'user_1',
    players: [
      {
        id: 'user_1',
        nickname: 'Alice',
        hand: [{ id: 'c_guard_1', value: 1, name: '경비병', nameEn: 'Guard', icon: '🛡️', color: '#3182CE' }],
        discardPile: [],
        isEliminated: false,
        isProtected: false,
      },
      {
        id: 'user_2',
        nickname: 'Bob',
        hand: [{ id: 'c_priest_1', value: 2, name: '사제', nameEn: 'Priest', icon: '📜', color: '#4FD1C5' }],
        discardPile: [],
        isEliminated: false,
        isProtected: false,
      },
    ],
    deck: [{ id: 'c_baron_1', value: 3, name: '남작' }],
    actionLogs: [],
  };

  const res = executePlayCard(mockIo, room, 'user_1', {
    cardId: 'c_guard_1',
    targetUserId: 'user_2',
    guessValue: 2,
  });

  assert.strictEqual(res.success, true);
  assert(res.actionDetail, 'executePlayCard must return actionDetail');
  assert.strictEqual(res.actionDetail.resultType, 'GUARD_SUCCESS');
  assert.strictEqual(res.actionDetail.eliminatedPlayerId, 'user_2');
  assert.strictEqual(res.actionDetail.revealedCard.value, 2);
  assert.strictEqual(room.lastActionDetail.resultType, 'GUARD_SUCCESS');
  console.log('  ✅ Test 7 Passed: Structured actionDetail payload verified.\n');
}

console.log('🎉 ALL 7 UNIT TESTS PASSED SUCCESSFULLY!\n');
