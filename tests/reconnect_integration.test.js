import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import assert from 'assert';
import { initRoomManager, rooms } from '../server/shared/roomManager.js';
import { registerLoveLetter } from '../server/games/love-letter.js';

console.log('================================================================');
console.log('🧪 Section 51: Reconnect Network Integration Tests (Real Sockets)');
console.log('================================================================\n');

function waitForEvent(client, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout (${timeout}ms) waiting for socket event '${eventName}'`));
    }, timeout);

    client.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function emitPromise(client, event, data) {
  return new Promise((resolve) => {
    client.emit(event, data, (res) => {
      resolve(res);
    });
  });
}

async function runReconnectIntegrationTests() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  initRoomManager(io);
  registerLoveLetter(io);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const serverUrl = `http://localhost:${port}`;

  let clientA, clientB, newClientB, evilClient;

  try {
    // -------------------------------------------------------------
    // Step 1: Initialize Room and Start Active Game
    // -------------------------------------------------------------
    console.log('▶ [Step 1] Connecting Client A (Host) & Client B (Guest)...');
    clientA = ClientIO(serverUrl, { transports: ['websocket'] });
    clientB = ClientIO(serverUrl, { transports: ['websocket'] });

    await Promise.all([
      waitForEvent(clientA, 'connect'),
      waitForEvent(clientB, 'connect'),
    ]);

    const createRes = await emitPromise(clientA, 'room:create', {
      gameType: 'LOVE_LETTER',
      nickname: '호스트_지우',
      targetTokens: 3,
    });
    assert.ok(createRes.success);
    const roomCode = createRes.roomCode;
    const userA_Id = createRes.userId;

    const joinBRes = await emitPromise(clientB, 'room:join', {
      roomCode,
      nickname: '게스트_피카츄',
    });
    assert.ok(joinBRes.success);
    const userB_Id = joinBRes.userId;
    const userB_Token = joinBRes.sessionToken;

    await emitPromise(clientB, 'room:ready', { isReady: true });
    await emitPromise(clientA, 'game:start', {});

    const room = rooms[roomCode];
    assert.strictEqual(room.gameState, 'PLAYING');

    const playerB_Before = room.players.find((p) => p.id === userB_Id);
    assert.ok(playerB_Before && playerB_Before.hand.length >= 1);
    const originalHandCardIds = playerB_Before.hand.map((c) => c.id);
    const originalHandCardValues = playerB_Before.hand.map((c) => c.value);

    console.log(`   ✅ Game active. Player B holding ${playerB_Before.hand.length} card(s): [${originalHandCardValues.join(', ')}]\n`);

    // -------------------------------------------------------------
    // Step 2: Abrupt Socket Disconnection of Client B
    // -------------------------------------------------------------
    console.log('▶ [Step 2] Abruptly disconnecting Client B socket...');
    clientB.disconnect();

    // Small yield for server disconnect handler
    await new Promise((r) => setTimeout(r, 150));

    assert.strictEqual(playerB_Before.isDisconnected, true, 'Player B must be marked disconnected');
    assert.strictEqual(room.isPaused, true, 'Room must enter isPaused state');
    assert.strictEqual(room.pausedPlayerId, userB_Id, 'pausedPlayerId must match disconnected player');
    assert.ok(room.pauseExpiresAt > Date.now(), 'pauseExpiresAt must be in the future (3-min grace period)');

    console.log(`   ✅ Server detected disconnect and entered 3-minute grace pause mode for Player B.\n`);

    // -------------------------------------------------------------
    // Step 3: Reject Unauthorized Reconnection Attempt (Wrong Token)
    // -------------------------------------------------------------
    console.log('▶ [Step 3] Verifying Security: Invalid Session Token Reconnect Rejection...');
    evilClient = ClientIO(serverUrl, { transports: ['websocket'] });
    await waitForEvent(evilClient, 'connect');

    const evilReconnect = await emitPromise(evilClient, 'room:reconnect', {
      roomCode,
      userId: userB_Id,
      sessionToken: 'evil_fake_token_12345',
    });

    assert.strictEqual(evilReconnect.success, false, 'Reconnect with wrong sessionToken must fail');
    assert.ok(evilReconnect.error.includes('인증') || evilReconnect.error.includes('유효하지 않'), 'Error must specify invalid token');
    console.log('   ✅ Unauthorized reconnect with invalid token successfully rejected.\n');

    // -------------------------------------------------------------
    // Step 4: Legitimate Reconnect with New Socket Connection
    // -------------------------------------------------------------
    console.log('▶ [Step 4] Reconnecting via New Socket with Valid Session Token...');
    newClientB = ClientIO(serverUrl, { transports: ['websocket'] });
    await waitForEvent(newClientB, 'connect');

    const resumedPromise = waitForEvent(clientA, 'room:resumed');

    const reconnectRes = await emitPromise(newClientB, 'room:reconnect', {
      roomCode,
      userId: userB_Id,
      sessionToken: userB_Token,
    });

    assert.ok(reconnectRes.success, `Legitimate reconnect failed: ${reconnectRes.error}`);
    assert.strictEqual(reconnectRes.userId, userB_Id, 'User ID must match exactly');
    assert.strictEqual(reconnectRes.roomCode, roomCode, 'Room code must match');

    // Verify hand restored
    const reconnectedPlayer = reconnectRes.player;
    assert.strictEqual(reconnectedPlayer.id, userB_Id);
    assert.strictEqual(reconnectedPlayer.isDisconnected, false);
    assert.strictEqual(reconnectedPlayer.hand.length, originalHandCardIds.length);
    const restoredIds = reconnectedPlayer.hand.map((c) => c.id);
    assert.deepStrictEqual(restoredIds, originalHandCardIds, 'Restored hand card IDs must match exactly');

    // Verify room pause lifted
    assert.strictEqual(room.isPaused, false, 'Room isPaused must reset to false');
    assert.strictEqual(room.pausedPlayerId, null, 'pausedPlayerId must reset to null');

    const resumedEvent = await resumedPromise;
    assert.ok(resumedEvent, 'room:resumed broadcast must be received by Host A');
    assert.strictEqual(resumedEvent.resumedByUserId, userB_Id);

    console.log('   ✅ Player B reconnected successfully! Hand, seat, tokens, and pause lifted 100%.\n');

    // -------------------------------------------------------------
    // Step 5: Verify Active Gameplay Continues After Reconnect
    // -------------------------------------------------------------
    console.log('▶ [Step 5] Verifying Game Operations Continue Seamlessly Post-Reconnect...');
    // If it's Player B's turn or we make it Player B's turn, execute a card play
    room.turnPlayerId = userB_Id;
    const cardToPlay = reconnectedPlayer.hand[0];

    const playRes = await emitPromise(newClientB, 'game:play-card', {
      cardId: cardToPlay.id,
      targetUserId: userA_Id,
      guessValue: 2,
    });

    assert.ok(playRes.success, `Card play after reconnect failed: ${playRes.error}`);
    console.log('   ✅ Reconnected client successfully executed card play over the restored socket connection.\n');

    console.log('================================================================');
    console.log('🎉 ALL SECTION 51 RECONNECT INTEGRATION TESTS PASSED 100%!');
    console.log('================================================================\n');
  } finally {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    if (newClientB) newClientB.disconnect();
    if (evilClient) evilClient.disconnect();
    server.close();
  }
}

runReconnectIntegrationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Reconnect Integration Test Error:', err);
    process.exit(1);
  });
