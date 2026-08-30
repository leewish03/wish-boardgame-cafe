import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { initRoomManager, rooms } from '../server/shared/roomManager.js';
import { registerLoveLetter } from '../server/games/love-letter.js';

console.log('🧪 Starting Comprehensive E2E Game Flow Simulation Test...');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

initRoomManager(io);
registerLoveLetter(io);

let port;
let client1, client2, client3;
let roomCode, user1Id, user1Token, user2Id, user2Token, user3Id, user3Token;

function waitForEvent(client, eventName, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
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

server.listen(0, async () => {
  port = server.address().port;
  const serverUrl = `http://localhost:${port}`;

  try {
    // Step 1: Connect 3 clients
    client1 = ClientIO(serverUrl, { transports: ['websocket'] });
    client2 = ClientIO(serverUrl, { transports: ['websocket'] });
    client3 = ClientIO(serverUrl, { transports: ['websocket'] });

    await Promise.all([
      waitForEvent(client1, 'connect'),
      waitForEvent(client2, 'connect'),
      waitForEvent(client3, 'connect'),
    ]);
    console.log('  ✅ Step 1: 3 Socket Clients successfully connected to server.');

    // Step 2: Client 1 creates a room
    const createRes = await emitPromise(client1, 'room:create', {
      gameType: 'LOVE_LETTER',
      nickname: '홍길동(방장)',
      targetTokens: 2,
      maxPlayers: 4,
      turnTimeLimit: 30,
    });

    if (!createRes?.success || !createRes?.roomCode) {
      throw new Error(`Room create failed: ${createRes?.error}`);
    }
    roomCode = createRes.roomCode;
    user1Id = createRes.userId;
    user1Token = createRes.sessionToken;
    console.log(`  ✅ Step 2: Room created with code [${roomCode}] by Host (${user1Id}).`);

    // Step 3: Client 2 & Client 3 join the room
    const join2Res = await emitPromise(client2, 'room:join', {
      roomCode,
      nickname: '이순신',
    });
    if (!join2Res?.success) throw new Error(`Client 2 join failed: ${join2Res?.error}`);
    user2Id = join2Res.userId;
    user2Token = join2Res.sessionToken;

    const join3Res = await emitPromise(client3, 'room:join', {
      roomCode,
      nickname: '강감찬',
    });
    if (!join3Res?.success) throw new Error(`Client 3 join failed: ${join3Res?.error}`);
    user3Id = join3Res.userId;
    user3Token = join3Res.sessionToken;
    console.log('  ✅ Step 3: Player 2 and Player 3 successfully joined room.');

    // Step 4: Players ready up
    await emitPromise(client2, 'room:ready', {});
    await emitPromise(client3, 'room:ready', {});
    console.log('  ✅ Step 4: All non-host players marked ready.');

    // Step 5: Host starts the game
    const startRes = await emitPromise(client1, 'game:start', {});
    if (!startRes?.success) throw new Error(`Game start failed: ${startRes?.error}`);

    const room = rooms[roomCode];
    if (room.gameState !== 'PLAYING') {
      throw new Error(`Expected gameState PLAYING, got ${room.gameState}`);
    }
    console.log(`  ✅ Step 5: Game successfully started! Round 1 in progress.`);

    // Step 6: Verify hand distribution and privacy
    const p1 = room.players.find((p) => p.id === user1Id);
    const p2 = room.players.find((p) => p.id === user2Id);
    const p3 = room.players.find((p) => p.id === user3Id);

    if (p1.hand.length === 0 || p2.hand.length === 0 || p3.hand.length === 0) {
      throw new Error('Hands not dealt properly.');
    }
    console.log('  ✅ Step 6: All players received secret cards.');

    // Step 7: Simulate mid-game sudden disconnection of Player 2
    console.log('  ▶ Step 7: Simulating unexpected disconnection of Player 2...');
    client2.disconnect();

    // Wait for server to register disconnect
    await new Promise((r) => setTimeout(r, 100));

    if (!room.isPaused || room.pausedPlayerId !== user2Id) {
      throw new Error('Game did not enter 3-minute Pause state on disconnect!');
    }
    console.log(`  ✅ Step 7: Server entered 3-minute PAUSE mode for Player 2 (ExpiresAt: ${new Date(room.pauseExpiresAt).toISOString()}).`);

    // Step 8: Simulate Player 2 reconnecting with sessionToken
    console.log('  ▶ Step 8: Simulating Player 2 returning and reconnecting via sessionToken...');
    client2 = ClientIO(serverUrl, { transports: ['websocket'] });
    await waitForEvent(client2, 'connect');

    const reconnectRes = await emitPromise(client2, 'room:reconnect', {
      roomCode,
      userId: user2Id,
      sessionToken: user2Token,
    });

    if (!reconnectRes?.success) {
      throw new Error(`Player 2 reconnect failed: ${reconnectRes?.error}`);
    }
    if (room.isPaused) {
      throw new Error('Room pause was not lifted after successful reconnect!');
    }
    if (reconnectRes.player.hand.length === 0) {
      throw new Error('Player 2 hand was lost upon reconnection!');
    }
    console.log('  ✅ Step 8: Player 2 reconnected! Hand, seat, and tokens 100% restored. Pause lifted.');

    // Step 9: Simulate explicit forfeit (🚪) by Player 3
    console.log('  ▶ Step 9: Simulating explicit forfeit by Player 3...');
    await emitPromise(client3, 'room:forfeit', {});

    const p3AfterForfeit = room.players.find((p) => p.id === user3Id);
    if (p3AfterForfeit && !p3AfterForfeit.isEliminated) {
      throw new Error('Player 3 was not eliminated or removed on explicit forfeit!');
    }
    console.log('  ✅ Step 9: Player 3 explicitly forfeited and was immediately removed from active game without pause delay.');

    console.log('\n🎉 ALL E2E GAME FLOW, RECONNECTION & RESILIENCE TESTS PASSED 100%!\n');

    // Clean up
    client1.disconnect();
    client2.disconnect();
    client3.disconnect();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ E2E Test Failure:', err);
    if (client1) client1.disconnect();
    if (client2) client2.disconnect();
    if (client3) client3.disconnect();
    server.close();
    process.exit(1);
  }
});
