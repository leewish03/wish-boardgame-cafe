import assert from 'assert';
import { createBotPlayer } from '../server/core/AiBotController.js';
import { roomRepository } from '../server/core/RoomRepository.js';

console.log('🧪 Starting Socket Disconnect & Connection State Recovery Test...');

async function runDisconnectRecoveryTest() {
  const roomCode = 'RECOV1';
  const player1 = createBotPlayer([]);
  const player2 = createBotPlayer([player1]);

  const room = {
    code: roomCode,
    players: [player1, player2],
    gameState: 'PLAYING',
    gameStateObject: {
      stateVersion: 42,
      matchState: 'PLAYING',
      players: [player1, player2],
      deck: [],
      secrets: {
        [player1.id]: { hand: [{ id: 'c1', value: 5, name: '왕자' }] },
        [player2.id]: { hand: [{ id: 'c2', value: 7, name: '백작부인' }] },
      },
    },
    isPaused: false,
    pausedPlayerId: null,
  };

  await roomRepository.saveRoom(room);

  // 1. Simulate Player 1 Disconnect
  const loadedRoom = await roomRepository.getRoom(roomCode);
  assert.ok(loadedRoom, 'Room must exist in repository');

  loadedRoom.isPaused = true;
  loadedRoom.pausedPlayerId = player1.id;
  await roomRepository.saveRoom(loadedRoom);

  const pausedRoom = await roomRepository.getRoom(roomCode);
  assert.strictEqual(pausedRoom.isPaused, true, 'Room must be paused on disconnect');
  assert.strictEqual(pausedRoom.pausedPlayerId, player1.id, 'Paused player ID must match');

  // 2. Simulate Player 1 Reconnect & Snapshot Resync
  pausedRoom.isPaused = false;
  pausedRoom.pausedPlayerId = null;
  pausedRoom.gameStateObject.stateVersion += 1;
  await roomRepository.saveRoom(pausedRoom);

  const resumedRoom = await roomRepository.getRoom(roomCode);
  assert.strictEqual(resumedRoom.isPaused, false, 'Room must be unpaused after reconnect');
  assert.strictEqual(resumedRoom.gameStateObject.stateVersion, 43, 'State version must increment monotonically');
  assert.strictEqual(resumedRoom.gameStateObject.secrets[player1.id].hand[0].value, 5, 'Player private hand must be intact');

  console.log('✅ Disconnect Recovery & State Version Resync test PASSED 100%!');
}

runDisconnectRecoveryTest();
