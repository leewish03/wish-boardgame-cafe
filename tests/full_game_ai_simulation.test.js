import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import assert from 'assert';
import { initRoomManager, rooms } from '../server/shared/roomManager.js';
import { registerLoveLetter } from '../server/games/love-letter.js';

console.log('🧪 Starting Full Human + 3 AI Bots CLI Simulation...');

async function runFullSimulation() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: '*' } });

  initRoomManager(io);
  registerLoveLetter(io);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const serverUrl = `http://localhost:${port}`;

  console.log(`📡 In-Memory Game Server running on port ${port}`);

  // 1. Connect Human Player
  const humanSocket = ClientIO(serverUrl, { reconnection: false, forceNew: true });
  await new Promise((resolve) => humanSocket.on('connect', resolve));
  console.log('✅ Human Socket connected:', humanSocket.id);

  let currentRoomState = null;
  humanSocket.on('room:state', (state) => {
    currentRoomState = state;
  });

  // 2. Human creates Room
  const createRes = await new Promise((resolve) => {
    humanSocket.emit(
      'room:create',
      {
        gameType: 'LOVE_LETTER',
        nickname: '인간호스트',
        targetTokens: 2,
        maxPlayers: 4,
      },
      resolve
    );
  });

  assert.strictEqual(createRes.success, true);
  const roomCode = createRes.roomCode;
  const humanUserId = createRes.userId;
  console.log(`✅ Room created: [${roomCode}] by [${humanUserId}]`);

  // 3. Add 3 AI Bots
  for (let i = 1; i <= 3; i++) {
    const addBotRes = await new Promise((resolve) => {
      humanSocket.emit('room:add-bot', { roomCode, userId: humanUserId }, resolve);
    });
    assert.strictEqual(addBotRes.success, true, `Bot ${i} addition failed`);
    console.log(`✅ Bot ${i} Added: ${addBotRes.bot.nickname} (${addBotRes.bot.personality})`);
  }

  // Verify 4 players
  const room = rooms[roomCode];
  assert.strictEqual(room.players.length, 4);

  // 4. Start Game
  const startRes = await new Promise((resolve) => {
    humanSocket.emit('game:start', { roomCode, userId: humanUserId }, resolve);
  });
  assert.strictEqual(startRes.success, true);
  console.log('✅ Game Started! Round 1 underway.');

  // Wait for initial room state broadcast
  await new Promise((r) => setTimeout(r, 200));

  // 5. Simulate Gameplay Rounds
  let moves = 0;
  const maxMoves = 40;

  while (moves < maxMoves) {
    moves++;
    await new Promise((r) => setTimeout(r, 300));

    if (!room || room.gameState === 'GAME_OVER') {
      console.log('👑 Game reached GAME_OVER!');
      break;
    }

    if (room.gameState === 'ROUND_END') {
      console.log(`🎉 Round End reached! Winner: ${room.roundWinner?.nickname}. Restarting next round...`);
      await new Promise((resolve) => {
        humanSocket.emit('game:start', { roomCode, userId: humanUserId }, resolve);
      });
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }

    const currentTurnId = room.turnPlayerId;
    const isHumanTurn = currentTurnId === humanUserId;

    if (isHumanTurn) {
      const humanPlayer = room.players.find((p) => p.id === humanUserId);
      if (!humanPlayer || humanPlayer.isEliminated) {
        continue;
      }

      console.log(`\n👉 [Human Turn] Hand: ${humanPlayer.hand.map((c) => `${c.name}(${c.value})`).join(', ')}`);

      // Pick playable card (Countess check)
      const hasCountess = humanPlayer.hand.some((c) => c.value === 7);
      const hasPrinceOrKing = humanPlayer.hand.some((c) => c.value === 5 || c.value === 6);
      let cardToPlay = humanPlayer.hand[0];

      if (hasCountess && hasPrinceOrKing) {
        cardToPlay = humanPlayer.hand.find((c) => c.value === 7);
      }

      // Pick target if needed
      const eligibleOpponents = room.players.filter(
        (p) => p.id !== humanUserId && !p.isEliminated && !p.isProtected
      );

      let targetUserId = null;
      let guessValue = null;

      if ([1, 2, 3, 6].includes(cardToPlay.value)) {
        if (eligibleOpponents.length > 0) {
          targetUserId = eligibleOpponents[0].id;
          if (cardToPlay.value === 1) {
            guessValue = 2; // Guess Priest (2)
          }
        }
      } else if (cardToPlay.value === 5) {
        // Prince
        targetUserId = eligibleOpponents.length > 0 ? eligibleOpponents[0].id : humanUserId;
      }

      console.log(
        `▶ Human Playing: ${cardToPlay.name}(${cardToPlay.value}) targeting [${targetUserId || 'None'}] with guess [${guessValue || 'None'}]`
      );

      const playRes = await new Promise((resolve) => {
        humanSocket.emit(
          'game:play-card',
          {
            roomCode,
            userId: humanUserId,
            cardId: cardToPlay.id,
            targetUserId,
            guessValue,
          },
          resolve
        );
      });

      assert.strictEqual(playRes.success, true, `Human play failed: ${playRes.error}`);
      console.log(`✅ Human Card Play Succeeded: ${playRes.actionDetail?.resultDescription || 'OK'}`);
    } else {
      // AI Turn: Wait for AI heuristic engine to execute
      const bot = room.players.find((p) => p.id === currentTurnId);
      if (bot && bot.isBot) {
        // Wait for bot thinking timer
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  console.log('\n📊 Final Scoreboard:');
  room.players.forEach((p) => {
    console.log(`   - ${p.nickname}: ${p.tokens || 0} tokens`);
  });

  humanSocket.disconnect();
  server.close();
  console.log('\n🎉 FULL HUMAN + 3 AI BOTS GAMEPLAY SIMULATION PASSED WITH 0 ERRORS!\n');
}

runFullSimulation().catch((err) => {
  console.error('\n❌ Simulation Failed:', err);
  process.exit(1);
});
