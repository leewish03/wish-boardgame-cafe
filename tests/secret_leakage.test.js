import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import assert from 'assert';
import { initRoomManager, rooms } from '../server/shared/roomManager.js';
import { registerLoveLetter, executePlayCard } from '../server/games/love-letter.js';

console.log('================================================================');
console.log('🧪 Section 50: Secret Leakage & Payload Privacy Security Tests');
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

async function runSecretLeakageTests() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  initRoomManager(io);
  registerLoveLetter(io);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const serverUrl = `http://localhost:${port}`;

  let clientA, clientB, clientC;
  let totalPayloadsInspected = 0;
  let totalAssertionsChecked = 0;

  try {
    console.log('▶ [Step 1] Initializing 3 Players (Host A, Guest B, Guest C)...');
    clientA = ClientIO(serverUrl, { transports: ['websocket'] });
    clientB = ClientIO(serverUrl, { transports: ['websocket'] });
    clientC = ClientIO(serverUrl, { transports: ['websocket'] });

    await Promise.all([
      waitForEvent(clientA, 'connect'),
      waitForEvent(clientB, 'connect'),
      waitForEvent(clientC, 'connect'),
    ]);

    const createRes = await emitPromise(clientA, 'room:create', {
      gameType: 'LOVE_LETTER',
      nickname: 'PlayerA(Host)',
      targetTokens: 3,
    });
    const roomCode = createRes.roomCode;
    const userA_Id = createRes.userId;

    const joinBRes = await emitPromise(clientB, 'room:join', {
      roomCode,
      nickname: 'PlayerB(Observer/Target)',
    });
    const userB_Id = joinBRes.userId;

    const joinCRes = await emitPromise(clientC, 'room:join', {
      roomCode,
      nickname: 'PlayerC(Victim)',
    });
    const userC_Id = joinCRes.userId;

    await emitPromise(clientB, 'room:ready', { isReady: true });
    await emitPromise(clientC, 'room:ready', { isReady: true });

    // Hook ALL events received by Client B (Guest B)
    const receivedEventsByB = [];
    const clientB_onevent = clientB.onevent;
    clientB.onevent = function (packet) {
      const [eventName, data] = packet.data || [];
      receivedEventsByB.push({ eventName, data, timestamp: Date.now() });
      if (clientB_onevent) clientB_onevent.apply(this, arguments);
    };

    console.log('▶ [Step 2] Starting Game & Inspecting Initial Broadcast Payloads...');
    await emitPromise(clientA, 'game:start', {});

    const room = rooms[roomCode];
    assert.strictEqual(room.gameState, 'PLAYING');

    // Helper: Deep recursive payload inspection
    function inspectPayloadForSecrets(data, path = '') {
      if (!data || typeof data !== 'object') return;
      totalPayloadsInspected++;

      // Check 1: No secret deck array in payload
      if (Array.isArray(data.deck) && data.deck.length > 0) {
        throw new Error(`[LEAK DETECTED at ${path}.deck]: Full deck array exposed!`);
      }
      totalAssertionsChecked++;

      // Check 2: No setAsideSecretCard exposed
      if (data.setAsideSecretCard !== undefined) {
        throw new Error(`[LEAK DETECTED at ${path}.setAsideSecretCard]: Secret set-aside card exposed!`);
      }
      totalAssertionsChecked++;

      // Check 3: In room:state or players list, opponents hand must be empty
      if (data.players && Array.isArray(data.players)) {
        for (const p of data.players) {
          if (p.id !== userB_Id) {
            if (p.hand && p.hand.length > 0) {
              throw new Error(
                `[LEAK DETECTED at ${path}.players[${p.id}].hand]: Opponent ${p.nickname}'s secret hand cards (${JSON.stringify(
                  p.hand
                )}) leaked to Player B!`
              );
            }
          }
          totalAssertionsChecked++;
        }
      }

      // Check 4: No secret private hands in gameStateObject
      if (data.secrets && typeof data.secrets === 'object') {
        for (const [pId, secret] of Object.entries(data.secrets)) {
          if (pId !== userB_Id && secret && secret.hand && secret.hand.length > 0) {
            throw new Error(`[LEAK DETECTED at ${path}.secrets[${pId}]]: Secret hand leaked in snapshot!`);
          }
        }
      }

      // Recurse on children
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object') {
          inspectPayloadForSecrets(value, `${path}.${key}`);
        }
      }
    }

    // Inspect all received events so far
    for (const ev of receivedEventsByB) {
      inspectPayloadForSecrets(ev.data, `Event[${ev.eventName}]`);
    }

    console.log('   ✅ Initial state broadcasts strictly hide opponents hands, deck order, and secret aside card.');

    // -------------------------------------------------------------
    // Test Priest Privacy: Player A plays Priest targeting Player C
    // -------------------------------------------------------------
    console.log('\n▶ [Step 3] Testing Priest Privacy: Player A plays Priest targeting Player C...');
    const playerA = room.players.find((p) => p.id === userA_Id);
    const playerC = room.players.find((p) => p.id === userC_Id);

    // Give Player A Priest(2) and Player C Princess(8)
    playerA.hand = [{ id: 'priest_card', value: 2, name: '사제', nameEn: 'Priest' }];
    playerC.hand = [{ id: 'princess_card', value: 8, name: '공주', nameEn: 'Princess' }];
    room.turnPlayerId = userA_Id;

    let priestEventReceivedByA = null;
    let priestEventReceivedByB = null;

    clientA.once('game:priest-result', (data) => {
      priestEventReceivedByA = data;
    });
    clientB.on('game:priest-result', (data) => {
      priestEventReceivedByB = data;
    });

    const priestEventsBefore = receivedEventsByB.length;

    await emitPromise(clientA, 'game:play-card', {
      cardId: 'priest_card',
      targetUserId: userC_Id,
    });

    await new Promise((r) => setTimeout(r, 100));

    // Verify Player A received priest result
    assert.ok(priestEventReceivedByA, 'Player A (Priest actor) must receive game:priest-result');
    assert.strictEqual(priestEventReceivedByA.card.value, 8, 'Player A sees Princess(8)');

    // Verify Player B DID NOT receive game:priest-result
    assert.strictEqual(
      priestEventReceivedByB,
      null,
      '[LEAK DETECTED]: Player B received private game:priest-result meant only for Player A!'
    );

    // Inspect all new events received by Player B during Priest action
    const newEventsForB = receivedEventsByB.slice(priestEventsBefore);
    for (const ev of newEventsForB) {
      inspectPayloadForSecrets(ev.data, `PriestAction-Event[${ev.eventName}]`);
      // Verify action-result broadcast does NOT reveal the peeked card value
      if (ev.eventName === 'game:action-result' || ev.eventName === 'game:action-showcase') {
        if (ev.data.revealedCard) {
          throw new Error('[LEAK DETECTED]: Priest peek card revealed in public action result!');
        }
      }
      totalAssertionsChecked++;
    }

    console.log('   ✅ Priest private card reveal confirmed 100% private to actor (0 leaks to Player B).');

    // -------------------------------------------------------------
    // Test Multi-Turn Security: Simulate 10 card plays
    // -------------------------------------------------------------
    console.log('\n▶ [Step 4] Testing Multi-Turn Payload Security across various actions...');
    for (let round = 0; round < 5; round++) {
      const turnP = room.players.find((p) => p.id === room.turnPlayerId && !p.isEliminated);
      if (!turnP) break;

      const card = turnP.hand[0] || { id: 'c_guard', value: 1, name: '경비병', nameEn: 'Guard' };
      if (turnP.hand.length === 0) turnP.hand.push(card);

      const targetP = room.players.find((p) => p.id !== turnP.id && !p.isEliminated);
      executePlayCard(io, room, turnP.id, {
        cardId: card.id,
        targetUserId: targetP ? targetP.id : null,
        guessValue: 2,
      });

      // Verify all accumulated events
      for (const ev of receivedEventsByB) {
        inspectPayloadForSecrets(ev.data, `Round${round}-Event[${ev.eventName}]`);
      }
    }

    console.log(`   ✅ Checked ${totalPayloadsInspected} payload objects and ${totalAssertionsChecked} security assertions.`);

    console.log('\n================================================================');
    console.log('🎉 ALL SECTION 50 SECRET LEAKAGE TESTS PASSED: 0 LEAKS DETECTED!');
    console.log('================================================================\n');
  } finally {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    if (clientC) clientC.disconnect();
    server.close();
  }
}

runSecretLeakageTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Secret Leakage Test Error:', err);
    process.exit(1);
  });
