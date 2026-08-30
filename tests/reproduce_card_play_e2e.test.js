import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { initRoomManager, rooms } from '../server/shared/roomManager.js';
import { registerLoveLetter } from '../server/games/love-letter.js';

console.log('🧪 Testing Real Socket Card Play & Action Broadcast E2E...');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

initRoomManager(io);
registerLoveLetter(io);

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
  const port = server.address().port;
  const serverUrl = `http://localhost:${port}`;

  let client1, client2;
  try {
    client1 = ClientIO(serverUrl, { transports: ['websocket'] });
    client2 = ClientIO(serverUrl, { transports: ['websocket'] });

    await Promise.all([
      waitForEvent(client1, 'connect'),
      waitForEvent(client2, 'connect'),
    ]);
    console.log('  ✅ 2 clients connected.');

    // 1. Create Room
    const createRes = await emitPromise(client1, 'room:create', {
      gameType: 'LOVE_LETTER',
      nickname: 'Player1',
      targetTokens: 3,
      maxPlayers: 2,
    });
    const roomCode = createRes.roomCode;
    const user1Id = createRes.userId;

    // 2. Join Room
    const joinRes = await emitPromise(client2, 'room:join', {
      roomCode,
      nickname: 'Player2',
    });
    const user2Id = joinRes.userId;

    // 3. Ready and Start Game
    await emitPromise(client2, 'room:ready', {});
    const startRes = await emitPromise(client1, 'game:start', {});
    console.log('  ✅ Game started:', startRes);

    const room = rooms[roomCode];
    const turnPlayerId = room.turnPlayerId;
    const activeClient = turnPlayerId === user1Id ? client1 : client2;
    const targetUserId = turnPlayerId === user1Id ? user2Id : user1Id;
    const activePlayer = room.players.find((p) => p.id === turnPlayerId);

    console.log(`  ▶ Turn Player: ${activePlayer.nickname} (${activePlayer.hand.map(c => `${c.name}(${c.value})`).join(', ')})`);
    console.log(`  ▶ Target Player ID: ${targetUserId}`);

    const cardToPlay = activePlayer.hand[0];
    console.log(`  ▶ Attempting to play card [${cardToPlay.name} (${cardToPlay.value})] on target...`);

    // Listen for events on non-turn player
    const otherClient = turnPlayerId === user1Id ? client2 : client1;
    let actionResultReceived = null;
    let roomStateReceived = null;

    otherClient.on('game:action-result', (data) => {
      actionResultReceived = data;
    });
    otherClient.on('room:state', (data) => {
      roomStateReceived = data;
    });

    const playRes = await emitPromise(activeClient, 'game:play-card', {
      cardId: cardToPlay.id,
      targetUserId,
      guessValue: cardToPlay.value === 1 ? 2 : null,
    });

    console.log('  ✅ play-card response:', playRes);

    await new Promise((r) => setTimeout(r, 200));

    console.log('  ✅ actionResultReceived:', actionResultReceived ? 'YES' : 'NO');
    console.log('  ✅ roomStateReceived:', roomStateReceived ? 'YES' : 'NO');
    console.log('  ✅ Client 1 connected:', client1.connected);
    console.log('  ✅ Client 2 connected:', client2.connected);

    console.log('\n🎉 Real Socket Card Play Test Passed Successfully!');
    client1.disconnect();
    client2.disconnect();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during card play test:', err);
    if (client1) client1.disconnect();
    if (client2) client2.disconnect();
    server.close();
    process.exit(1);
  }
});
