import assert from 'assert';
import {
  createBotPlayer,
  decideBotAction,
  recordPriestMemory,
  invalidatePlayerMemory,
} from '../server/games/love-letter-ai.js';
import {
  passTurnToNextPlayer,
} from '../server/games/love-letter.js';

console.log('🧪 Starting AI Bot Heuristics & Rules Test Suite...');

// Test 1: createBotPlayer creates valid bot structure
{
  console.log('\n[Test 1] createBotPlayer generation');
  const existing = [{ id: 'user_1', nickname: '알렉산더' }];
  const bot = createBotPlayer(existing);

  assert.strictEqual(bot.isBot, true);
  assert.strictEqual(bot.isReady, true);
  assert.notStrictEqual(bot.nickname, '알렉산더');
  assert.ok(bot.personality);
  assert.deepStrictEqual(bot.memory.knownPlayerCards, {});
  console.log(`✅ Bot created: ${bot.nickname} (${bot.personality})`);
}

// Test 2: Priest Memory Recording & Invalidation
{
  console.log('\n[Test 2] Priest Memory Tracking & Invalidation');
  const bot = createBotPlayer([]);
  recordPriestMemory(bot, 'target_1', 8);

  assert.strictEqual(bot.memory.knownPlayerCards['target_1'].cardValue, 8);
  console.log('✅ Recorded Princess in bot memory');

  invalidatePlayerMemory([bot], 'target_1');
  assert.strictEqual(bot.memory.knownPlayerCards['target_1'], undefined);
  console.log('✅ Memory correctly invalidated on card played/drawn');
}

// Test 3: Countess Constraint Enforcement in AI Bot
{
  console.log('\n[Test 3] AI Bot enforces Countess rule when holding Prince (5) or King (6)');
  const bot = createBotPlayer([]);
  bot.hand = [
    { id: 'c1', value: 7, name: '백작부인' },
    { id: 'c2', value: 5, name: '왕자' },
  ];

  const opponent = { id: 'opp_1', nickname: '플레이어1', isEliminated: false, isProtected: false };
  const room = {
    players: [bot, opponent],
    deck: [],
    discardPile: [],
    actionLogs: [],
  };

  const action = decideBotAction(room, bot);
  assert.strictEqual(action.cardId, 'c1', 'Bot MUST play Countess(7)');
  console.log('✅ Bot strictly prioritizes Countess(7) over Prince(5)');
}

// Test 4: Guard Snipe using Recorded Priest Memory
{
  console.log('\n[Test 4] Guard Snipe utilizing Memory');
  const bot = createBotPlayer([]);
  bot.hand = [
    { id: 'g1', value: 1, name: '경비병' },
    { id: 'p1', value: 4, name: '하녀' },
  ];

  const target = { id: 'target_99', nickname: '빅토리아', isEliminated: false, isProtected: false, hand: [{ value: 8 }] };
  const room = {
    players: [bot, target],
    deck: [],
    discardPile: [],
    actionLogs: [],
  };

  recordPriestMemory(bot, 'target_99', 8);

  const action = decideBotAction(room, bot);
  assert.strictEqual(action.cardId, 'g1', 'Bot chooses Guard');
  assert.strictEqual(action.targetUserId, 'target_99', 'Bot targets known victim');
  assert.strictEqual(action.guessValue, 8, 'Bot guesses Princess(8) with 100% accuracy');
  console.log('✅ Bot successfully performed precision memory snipe: Guard -> target_99 (Princess)');
}

// Test 5: Co-Winners Tie-Break Multi-Award
{
  console.log('\n[Test 5] Co-Winners Tie-Break in Empty Deck');
  const p1 = { id: 'p1', nickname: '호스트', tokens: 1, isEliminated: false, hand: [{ value: 6 }], discardPile: [{ value: 5 }] };
  const p2 = { id: 'p2', nickname: '게스트', tokens: 2, isEliminated: false, hand: [{ value: 6 }], discardPile: [{ value: 5 }] };

  const mockIo = {
    to: () => ({ emit: () => {} }),
  };

  const room = {
    code: 'TIEBRK',
    gameState: 'PLAYING',
    targetTokens: 4,
    players: [p1, p2],
    deck: [],
    discardPile: [],
    roundNumber: 1,
    actionLogs: [],
  };

  passTurnToNextPlayer(mockIo, room);

  assert.strictEqual(p1.tokens, 2, 'p1 gets +1 token');
  assert.strictEqual(p2.tokens, 3, 'p2 gets +1 token');
  assert.strictEqual(room.gameState, 'ROUND_END');
  console.log('✅ Both tied players successfully awarded affection tokens in tie-break');
}

console.log('\n🎉 ALL AI Bot Heuristics & Rules Tests PASSED 100%!\n');
