import assert from 'assert';
import {
  rooms,
  socketToUser,
  generateRoomCode,
  generateSessionToken,
  getPublicRoomState,
  handlePauseExpired,
} from '../server/shared/roomManager.js';
import {
  startRound,
  pauseGameTimer,
  resumeGameTimer,
  handleForfeitedPlayer,
  executePlayCard,
} from '../server/games/love-letter.js';

console.log('🧪 Starting Session Protection & Reconnection Unit Tests...\n');

// Mock socket.io instance
const createMockIo = () => {
  const events = [];
  return {
    events,
    to: (target) => ({
      emit: (event, data) => {
        events.push({ target, event, data });
      },
    }),
  };
};

// -------------------------------------------------------------
// Test 1: Session Token Generation and Initial State
// -------------------------------------------------------------
console.log('▶ Test 1: Session Token Generation and Public Room State');
{
  const userId = 'user_test_1';
  const token = generateSessionToken(userId);
  assert(token.startsWith('token_user_test_1_'), 'Session token must have prefix token_userId_');

  const room = {
    code: 'ROOM01',
    gameState: 'LOBBY',
    hostId: userId,
    targetTokens: 4,
    maxPlayers: 4,
    turnTimeLimit: 60,
    isPaused: false,
    pausedPlayerId: null,
    pauseExpiresAt: null,
    players: [
      {
        id: userId,
        sessionToken: token,
        nickname: 'Alice',
        hand: [{ id: 'c1', value: 1, name: '경비병' }],
        tokens: 0,
        isEliminated: false,
        isProtected: false,
        isDisconnected: false,
      },
    ],
  };

  const publicStateForSelf = getPublicRoomState(room, userId);
  assert.strictEqual(publicStateForSelf.players[0].hand.length, 1, 'Self can see own hand');
  assert.strictEqual(publicStateForSelf.isPaused, false, 'isPaused is false initially');

  const publicStateForOther = getPublicRoomState(room, 'other_user');
  assert.strictEqual(publicStateForOther.players[0].hand.length, 0, 'Others cannot see private hand');

  console.log('  ✅ Test 1 Passed: Session token generated & hand confidentiality preserved.\n');
}

// -------------------------------------------------------------
// Test 2: Game Pause & Timer Preservation on Disconnect
// -------------------------------------------------------------
console.log('▶ Test 2: Game Pause & Turn Timer Preservation on Disconnect');
{
  const room = {
    code: 'ROOM02',
    gameState: 'PLAYING',
    turnPlayerId: 'user_alice',
    turnStartTime: Date.now() - 10000, // 10s elapsed
    turnTimeLimit: 60,
    isPaused: false,
    pausedPlayerId: null,
    pauseExpiresAt: null,
    players: [
      {
        id: 'user_alice',
        nickname: 'Alice',
        hand: [{ id: 'c1', value: 1, name: '경비병' }],
        isEliminated: false,
        isProtected: false,
        isDisconnected: false,
      },
      {
        id: 'user_bob',
        nickname: 'Bob',
        hand: [{ id: 'c2', value: 2, name: '사제' }],
        isEliminated: false,
        isProtected: false,
        isDisconnected: false,
      },
    ],
    deck: [{ id: 'c3', value: 3, name: '남작' }],
    actionLogs: [],
  };

  // Simulate disconnect of Alice
  pauseGameTimer(room);
  room.isPaused = true;
  room.pausedPlayerId = 'user_alice';
  room.pauseExpiresAt = Date.now() + 180000;

  assert.strictEqual(room.isPaused, true, 'Room must be paused');
  assert(room.savedTurnRemainingMs <= 50000 && room.savedTurnRemainingMs >= 48000, 'Saved remaining time should be ~50s');

  // Attempting to play a card while paused must be rejected
  const mockIo = createMockIo();
  const playRes = executePlayCard(mockIo, room, 'user_alice', { cardId: 'c1' });
  assert.strictEqual(playRes.success, false, 'Card play must be blocked when game is paused');

  console.log('  ✅ Test 2 Passed: Game is paused, remaining time preserved, card play blocked.\n');
}

// -------------------------------------------------------------
// Test 3: Resume Game on Reconnection
// -------------------------------------------------------------
console.log('▶ Test 3: Game Resume on Successful Reconnect');
{
  const mockIo = createMockIo();
  const room = {
    code: 'ROOM03',
    gameState: 'PLAYING',
    turnPlayerId: 'user_alice',
    turnTimeLimit: 60,
    savedTurnRemainingMs: 45000,
    isPaused: true,
    pausedPlayerId: 'user_alice',
    pauseExpiresAt: Date.now() + 150000,
    players: [
      {
        id: 'user_alice',
        sessionToken: 'token_alice_valid',
        nickname: 'Alice',
        hand: [{ id: 'c1', value: 1, name: '경비병' }],
        isEliminated: false,
        isProtected: false,
        isDisconnected: true,
      },
      {
        id: 'user_bob',
        sessionToken: 'token_bob_valid',
        nickname: 'Bob',
        hand: [{ id: 'c2', value: 2, name: '사제' }],
        isEliminated: false,
        isProtected: false,
        isDisconnected: false,
      },
    ],
    deck: [{ id: 'c3', value: 3, name: '남작' }],
    actionLogs: [],
  };

  // Alice reconnects
  const alice = room.players[0];
  alice.isDisconnected = false;
  resumeGameTimer(mockIo, room);

  assert.strictEqual(room.isPaused, false, 'Room pause should be cleared');
  assert.strictEqual(room.savedTurnRemainingMs, null, 'Saved remaining ms should be reset');
  assert(room.turnTimer !== null, 'Turn timer should be restarted');

  clearTimeout(room.turnTimer);
  console.log('  ✅ Test 3 Passed: Game cleanly resumes with previous hand intact.\n');
}

// -------------------------------------------------------------
// Test 4: 3-Minute Timeout Expiration & Forfeit
// -------------------------------------------------------------
console.log('▶ Test 4: 3-Minute Timeout Expiration -> Auto Forfeit');
{
  const mockIo = createMockIo();
  const room = {
    code: 'ROOM04',
    gameState: 'PLAYING',
    turnPlayerId: 'user_alice',
    turnTimeLimit: 60,
    targetTokens: 4,
    isPaused: true,
    pausedPlayerId: 'user_alice',
    pauseExpiresAt: Date.now(),
    players: [
      {
        id: 'user_alice',
        nickname: 'Alice',
        hand: [{ id: 'c1', value: 1, name: '경비병' }],
        discardPile: [],
        tokens: 0,
        isEliminated: false,
        isProtected: false,
        isDisconnected: true,
      },
      {
        id: 'user_bob',
        nickname: 'Bob',
        hand: [{ id: 'c2', value: 2, name: '사제' }],
        discardPile: [],
        tokens: 0,
        isEliminated: false,
        isProtected: false,
        isDisconnected: false,
      },
    ],
    deck: [{ id: 'c3', value: 3, name: '남작' }],
    actionLogs: [],
  };
  rooms['ROOM04'] = room;

  // 3-minute timer expires
  handlePauseExpired(mockIo, 'ROOM04', 'user_alice');

  assert.strictEqual(room.players[0].isEliminated, true, 'Alice should be eliminated on timeout');
  assert.strictEqual(room.players[0].hand.length, 0, 'Alice hand should be discarded');
  assert.strictEqual(room.gameState, 'ROUND_END', 'Round should end as Bob is the last player alive');
  assert.strictEqual(room.roundWinner?.id, 'user_bob', 'Bob should win the round');

  delete rooms['ROOM04'];
  console.log('  ✅ Test 4 Passed: Expired player is eliminated and winner declared.\n');
}

// -------------------------------------------------------------
// Test 5: Explicit Forfeit (Door Icon / room:forfeit)
// -------------------------------------------------------------
console.log('▶ Test 5: Explicit Forfeit (No 3-minute wait)');
{
  const mockIo = createMockIo();
  const room = {
    code: 'ROOM05',
    gameState: 'PLAYING',
    turnPlayerId: 'user_alice',
    turnTimeLimit: 60,
    targetTokens: 4,
    isPaused: false,
    players: [
      {
        id: 'user_alice',
        nickname: 'Alice',
        hand: [{ id: 'c1', value: 1, name: '경비병' }],
        discardPile: [],
        tokens: 0,
        isEliminated: false,
        isProtected: false,
        isDisconnected: false,
      },
      {
        id: 'user_bob',
        nickname: 'Bob',
        hand: [{ id: 'c2', value: 2, name: '사제' }],
        discardPile: [],
        tokens: 0,
        isEliminated: false,
        isProtected: false,
        isDisconnected: false,
      },
      {
        id: 'user_charlie',
        nickname: 'Charlie',
        hand: [{ id: 'c3', value: 3, name: '남작' }],
        discardPile: [],
        tokens: 0,
        isEliminated: false,
        isProtected: false,
        isDisconnected: false,
      },
    ],
    deck: [{ id: 'c4', value: 4, name: '하녀' }],
    actionLogs: [],
  };

  // Alice explicitly forfeits
  handleForfeitedPlayer(mockIo, room, 'user_alice', true);

  assert.strictEqual(room.players.some((p) => p.id === 'user_alice'), false, 'Alice should be removed from players list');
  assert.strictEqual(room.turnPlayerId, 'user_bob', 'Turn should pass to Bob immediately');
  assert.strictEqual(room.isPaused, false, 'Room should not be paused');

  if (room.turnTimer) clearTimeout(room.turnTimer);
  console.log('  ✅ Test 5 Passed: Explicit forfeit immediately removes player and advances turn.\n');
}

console.log('🎉 ALL 5 RECONNECTION & SESSION PROTECTION TESTS PASSED!\n');
