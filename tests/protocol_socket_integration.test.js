import assert from 'assert';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { initRoomManager, rooms, broadcastRoomState } from '../server/shared/roomManager.js';
import { createLoveLetterService } from '../server/core/LoveLetterService.js';
import { registerLoveLetterController } from '../server/games/loveLetterController.js';

function once(socket, event, timeout = 3_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function emit(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function assertNoSecrets(snapshot, ownerId) {
  const encoded = JSON.stringify(snapshot);
  assert.ok(snapshot.publicState, 'protocol snapshot must include publicState');
  assert.ok(snapshot.privateState, 'protocol snapshot must include receiver privateState');
  assert.equal(snapshot.publicState.deck, undefined, 'deck order must not be present');
  assert.equal(snapshot.publicState.secrets, undefined, 'all secret hands must not be present');
  assert.equal(snapshot.publicState.setAsideCard, undefined, 'set-aside card must not be present');
  for (const player of snapshot.publicState.players) {
    assert.equal(player.hand, undefined, `public player ${player.id} must not have a hand`);
  }
  assert.equal(snapshot.privateState.id, ownerId, 'private state must belong to receiver');
  assert.equal(encoded.includes('"setAsideCard":'), false, 'serialized payload must not expose a set-aside card');
}

async function main() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  initRoomManager(io);
  const service = createLoveLetterService(io, { broadcastRoomState });
  registerLoveLetterController(io, service);
  await new Promise((resolve) => server.listen(0, resolve));

  const url = `http://127.0.0.1:${server.address().port}`;
  const a = ClientIO(url, { transports: ['websocket'] });
  const b = ClientIO(url, { transports: ['websocket'] });
  let testRoomCode = null;

  try {
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);
    const created = await emit(a, 'room:create', { gameType: 'LOVE_LETTER', nickname: 'Alice', targetTokens: 2 });
    assert.equal(created.success, true);
    testRoomCode = created.roomCode;
    const joined = await emit(b, 'room:join', { roomCode: created.roomCode, nickname: 'Bob' });
    assert.equal(joined.success, true);
    assert.equal((await emit(b, 'room:ready', { isReady: true })).success, true);

    const snapA = once(a, 'game:snapshot');
    const snapB = once(b, 'game:snapshot');
    assert.equal((await emit(a, 'game:start', {})).success, true);
    const [initialA, initialB] = await Promise.all([snapA, snapB]);
    assertNoSecrets(initialA, created.userId);
    assertNoSecrets(initialB, joined.userId);

    const room = rooms[created.roomCode];
    let state = room.gameStateObject;
    const stateVersionBeforePause = state.stateVersion;
    await service.pauseRoom(created.roomCode, state.currentTurnPlayerId);
    assert.equal(room.isPaused, true, 'disconnect pause must lock core commands and timers');
    const resumedSnapshotA = once(a, 'game:snapshot');
    const resumedSnapshotB = once(b, 'game:snapshot');
    await service.resumeRoom(created.roomCode);
    await Promise.all([resumedSnapshotA, resumedSnapshotB]);
    assert.equal(room.isPaused, false, 'valid reconnect must resume the core room');
    assert.ok(room.gameStateObject.stateVersion > stateVersionBeforePause, 'resume must produce a newer snapshot version');
    state = room.gameStateObject;
    const priestActorId = state.currentTurnPlayerId;
    const priestTargetId = state.players.find((player) => player.id !== priestActorId)?.id;
    const priestTargetCard = state.secrets[priestTargetId].hand[0];
    state.lastAction = {
      actionId: 'privacy-priest-action',
      actorId: priestActorId,
      card: { id: 'priest', value: 2, name: '사제' },
      targetId: priestTargetId,
      resultType: 'PRIEST_REVEAL',
      description: 'private reveal',
      revealedCard: priestTargetCard,
    };
    const privateSnapshotA = once(a, 'game:snapshot');
    const privateSnapshotB = once(b, 'game:snapshot');
    service.broadcastGameSnapshot(created.roomCode, room);
    const [redactedA, redactedB] = await Promise.all([privateSnapshotA, privateSnapshotB]);
    assert.equal(redactedA.publicState.lastAction.revealedCard, undefined, 'Priest reveal must be redacted from A public state');
    assert.equal(redactedB.publicState.lastAction.revealedCard, undefined, 'Priest reveal must be redacted from B public state');

    const turnId = state.currentTurnPlayerId;
    const turnSocket = turnId === created.userId ? a : b;
    const turnSecret = state.secrets[turnId];
    const card = turnSecret.hand.find((candidate) => candidate.value !== 8) || turnSecret.hand[0];
    const target = state.players.find((player) => player.id !== turnId && !player.isEliminated && !player.isProtected);
    const targetId = [1, 2, 3, 5, 6].includes(card.value) ? target?.id : undefined;
    // The public action must remain readable before the server advances the
    // authoritative turn, so this transition can take up to the action gate.
    const nextA = once(a, 'game:snapshot', 7_000);
    const nextB = once(b, 'game:snapshot', 7_000);
    const eventA = once(a, 'game:event');
    const command = await emit(turnSocket, 'game:command', {
      roomCode: created.roomCode,
      commandId: 'test-play-1',
      timestamp: Date.now(),
      command: {
        type: 'PLAY_CARD',
        cardId: card.id,
        targetId,
        guessValue: card.value === 1 ? 2 : undefined,
      },
    });
    assert.equal(command.success, true, command.error);
    const actionEvent = await eventA;
    // The presentation gate deliberately withholds the next-turn snapshot until the
    // acting client has completed the public card sequence.
    const presentationAck = await emit(turnSocket, 'game:presentation-ack', {
      roomCode: created.roomCode,
      actionId: actionEvent.actionId,
      expectedStateVersion: actionEvent.stateVersion,
      completedPhase: 'PUBLIC_SEQUENCE',
    });
    assert.equal(presentationAck.success, true, presentationAck.error);
    const [afterA, afterB] = await Promise.all([nextA, nextB]);
    assert.ok(afterA.stateVersion > initialA.stateVersion, 'state version must advance after a command');
    assertNoSecrets(afterA, created.userId);
    assertNoSecrets(afterB, joined.userId);
    assert.ok(actionEvent.event, 'game:event must be emitted for the action');
    assert.equal(actionEvent.event.type, 'CARD_PLAYED', 'first presentation event must identify the played card');
    console.log('✅ Protocol controller: server-authoritative command, private snapshots, and event stream verified.');
  } finally {
    if (testRoomCode) delete rooms[testRoomCode];
    a.disconnect();
    b.disconnect();
    io.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

