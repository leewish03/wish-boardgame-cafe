import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import assert from 'assert';
import { initRoomManager, rooms } from '../server/shared/roomManager.js';
import { registerLoveLetter } from '../server/games/love-letter.js';

console.log('================================================================');
console.log('🧪 Section 49: Socket Integration Tests (Real In-Process Network)');
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

async function runSocketIntegrationTest() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  initRoomManager(io);
  registerLoveLetter(io);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const serverUrl = `http://localhost:${port}`;

  console.log(`📡 In-process Socket.IO server started on ${serverUrl}`);

  let clientA, clientB, clientC;

  try {
    // 1. Connect 3 real socket clients
    console.log('▶ [Step 1] Connecting Client A, Client B, and Client C via WebSocket...');
    clientA = ClientIO(serverUrl, { transports: ['websocket'] });
    clientB = ClientIO(serverUrl, { transports: ['websocket'] });
    clientC = ClientIO(serverUrl, { transports: ['websocket'] });

    await Promise.all([
      waitForEvent(clientA, 'connect'),
      waitForEvent(clientB, 'connect'),
      waitForEvent(clientC, 'connect'),
    ]);
    console.log('   ✅ All 3 socket clients connected successfully.\n');

    // 2. Client A creates room
    console.log('▶ [Step 2] Client A creating Love Letter room...');
    const createRes = await emitPromise(clientA, 'room:create', {
      gameType: 'LOVE_LETTER',
      nickname: '호스트앨리스',
      targetTokens: 2,
      maxPlayers: 3,
      turnTimeLimit: 30,
    });

    assert.ok(createRes && createRes.success, `Room creation failed: ${createRes?.error}`);
    const roomCode = createRes.roomCode;
    const userA_Id = createRes.userId;
    const userA_Token = createRes.sessionToken;
    assert.ok(roomCode, 'Room code must be generated');
    console.log(`   ✅ Room created: Code=[${roomCode}], Host=${userA_Id}\n`);

    // 3. Client B and Client C join room
    console.log('▶ [Step 3] Client B and Client C joining room...');
    const joinBRes = await emitPromise(clientB, 'room:join', {
      roomCode,
      nickname: '게스트밥',
    });
    assert.ok(joinBRes && joinBRes.success, `Client B join failed: ${joinBRes?.error}`);
    const userB_Id = joinBRes.userId;

    const joinCRes = await emitPromise(clientC, 'room:join', {
      roomCode,
      nickname: '게스트찰리',
    });
    assert.ok(joinCRes && joinCRes.success, `Client C join failed: ${joinCRes?.error}`);
    const userC_Id = joinCRes.userId;
    console.log(`   ✅ Client B (${userB_Id}) & Client C (${userC_Id}) joined room successfully.\n`);

    // 4. Ready status toggles
    console.log('▶ [Step 4] Guests toggling ready state...');
    const readyB = await emitPromise(clientB, 'room:ready', { isReady: true });
    assert.ok(readyB && readyB.success && readyB.isReady === true);

    const readyC = await emitPromise(clientC, 'room:ready', { isReady: true });
    assert.ok(readyC && readyC.success && readyC.isReady === true);
    console.log('   ✅ Non-host players are ready.\n');

    // 5. Client A starts the game & 6. Verify room:state broadcast
    console.log('▶ [Step 5 & 6] Host starting game (game:start) & verifying room:state broadcast...');
    let stateA, stateB, stateC;
    const statePromise = new Promise((resolve) => {
      let receivedCount = 0;
      clientA.once('room:state', (s) => { stateA = s; if (++receivedCount === 3) resolve(); });
      clientB.once('room:state', (s) => { stateB = s; if (++receivedCount === 3) resolve(); });
      clientC.once('room:state', (s) => { stateC = s; if (++receivedCount === 3) resolve(); });
    });

    const startRes = await emitPromise(clientA, 'game:start', {});
    assert.ok(startRes && startRes.success, `Game start failed: ${startRes?.error}`);

    await statePromise;
    const room = rooms[roomCode];
    assert.ok(room, 'Room must exist in server memory');
    assert.strictEqual(room.gameState, 'PLAYING', 'Room gameState must transition to PLAYING');
    assert.strictEqual(room.players.length, 3, 'All 3 players must be in room');
    assert.ok(stateA && stateB && stateC);
    assert.strictEqual(stateA.gameState, 'PLAYING');
    console.log('   ✅ Game started and room:state received by all 3 clients.\n');

    // 7. Execute card play through Socket flow (play -> target -> result -> next turn)
    console.log('▶ [Step 7] Testing Card Play Flow via Socket.IO events...');
    const turnPlayerId = room.turnPlayerId;
    const turnClient = turnPlayerId === userA_Id ? clientA : turnPlayerId === userB_Id ? clientB : clientC;
    const nonTurnPlayers = room.players.filter((p) => p.id !== turnPlayerId && !p.isEliminated);
    const targetUserId = nonTurnPlayers[0].id;

    const turnPlayerObj = room.players.find((p) => p.id === turnPlayerId);
    assert.ok(turnPlayerObj && turnPlayerObj.hand.length >= 1);

    // Pick playable card (avoid Princess self-elimination if possible, handle Countess)
    const hasCountess = turnPlayerObj.hand.some((c) => c.value === 7);
    const hasRoyal = turnPlayerObj.hand.some((c) => c.value === 5 || c.value === 6);
    let cardToPlay;
    if (hasCountess && hasRoyal) {
      cardToPlay = turnPlayerObj.hand.find((c) => c.value === 7);
    } else {
      cardToPlay = turnPlayerObj.hand.find((c) => c.value !== 8) || turnPlayerObj.hand[0];
    }

    let actionResultPayload = null;
    let showcasePayload = null;

    const actionResultPromise = waitForEvent(clientB, 'game:action-result');
    const showcasePromise = waitForEvent(clientA, 'game:action-showcase');

    console.log(`   Turn Player (${turnPlayerObj.nickname}) playing [${cardToPlay.name}(${cardToPlay.value})]...`);
    const playRes = await emitPromise(turnClient, 'game:play-card', {
      roomCode: room.code,
      userId: turnPlayerId,
      cardId: cardToPlay.id,
      targetUserId: cardToPlay.value === 4 || cardToPlay.value === 7 || cardToPlay.value === 8 ? null : targetUserId,
      guessValue: cardToPlay.value === 1 ? 2 : undefined,
    });

    assert.ok(playRes && playRes.success, `Card play failed: ${playRes?.error}`);

    actionResultPayload = await actionResultPromise;
    showcasePayload = await showcasePromise;

    assert.ok(actionResultPayload, 'game:action-result must be broadcast');
    assert.strictEqual(actionResultPayload.actorId, turnPlayerId);
    assert.strictEqual(actionResultPayload.playedCard.value, cardToPlay.value);

    assert.ok(showcasePayload, 'game:action-showcase must be broadcast');
    assert.strictEqual(showcasePayload.actorId, turnPlayerId);
    console.log(`   ✅ game:action-result & game:action-showcase received with result: ${actionResultPayload.resultType}`);

    // 8. Verify Turn advanced to next player
    console.log('▶ [Step 8] Verifying Turn Transition to next alive player...');
    const nextTurnPlayerId = room.turnPlayerId;
    console.log(`   Previous Turn: ${turnPlayerId} -> Next Turn: ${nextTurnPlayerId}`);
    assert.ok(nextTurnPlayerId, 'Next turn player ID must be valid');
    const nextPlayerObj = room.players.find((p) => p.id === nextTurnPlayerId);
    assert.strictEqual(nextPlayerObj.isEliminated, false, 'Next turn player must not be eliminated');
    console.log(`   ✅ Turn transitioned successfully to [${nextPlayerObj.nickname}].\n`);

    console.log('================================================================');
    console.log('🎉 ALL SECTION 49 SOCKET INTEGRATION TESTS PASSED 100%!');
    console.log('================================================================\n');
  } finally {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    if (clientC) clientC.disconnect();
    server.close();
  }
}

runSocketIntegrationTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Socket Integration Test Error:', err);
    process.exit(1);
  });
