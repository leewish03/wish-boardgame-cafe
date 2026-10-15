import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mock } from 'node:test';
import { BoardGameService, boardGameCores } from '../server/core/BoardGameService.js';
import { roomRepository } from '../server/core/RoomRepository.js';
import { SupabaseRoomRepository, restoreRoom, clonePersistable } from '../server/core/SupabaseRoomRepository.js';
import { configureGameLifecycle } from '../server/shared/roomManager.js';

const io = { to: () => ({ emit() {} }) }, service = new BoardGameService(io), scenarios = [];
for (const type of Object.keys(boardGameCores)) configureGameLifecycle(type, { projectPublicState: (room, id) => service.projectRoomState(room, id) });
try {
  const sql = new SupabaseRoomRepository('postgres://unused');
  assert.doesNotThrow(() => sql.pool.emit('error', new Error('connection terminated')),
    'an idle database connection failure must not crash the game process');
  sql._rooms = roomRepository._rooms;
  const originalSave = roomRepository.saveRoom;
  const writes = [];
  sql.pool.query = async (_query, values) => { writes.push(JSON.parse(values[1])); };
  roomRepository.saveRoom = sql.saveRoom.bind(sql);
  try {
    const room = { code: 'FAILURE', gameType: 'WHITEHALL', hostId: 'a', hostRole: 'JACK', gameState: 'LOBBY', turnTimeLimit: 0,
      players: ['a', 'b'].map(id => ({ id, nickname: id, isReady: true, socketId: null })) };
    await roomRepository.saveRoom(room); await service.startMatch(room.code, 'a'); service.clearTimers(room.code);
    const before = clonePersistable(room), core = boardGameCores.WHITEHALL;
    const command = { ...core.chooseBotCommand(core.getBotObservation(room.gameStateObject, 'a'), 'a'), playerId: 'a', expectedVersion: room.stateVersion };
    sql.pool.query = async () => { throw new Error('temporary SQL outage'); };
    await assert.rejects(service.handleCommand(room.code, command), /temporary SQL outage/);
    assert.deepEqual(clonePersistable(room), before, 'failed SQL must not change canonical state/version/presentation');
    let resolveQuery, started;
    const entered = new Promise(resolve => { started = resolve; });
    sql.pool.query = async (_query, values) => { writes.push(JSON.parse(values[1])); started(); await new Promise(resolve => { resolveQuery = resolve; }); };
    const retry = service.handleCommand(room.code, command);
    await entered;
    assert.deepEqual(clonePersistable(room), before, 'pending SQL must not publish command');
    room.players[1].socketId = 'rejoined'; room.chatMessages = [{ id: 'concurrent', text: 'joined while saving' }];
    const metadataSave = roomRepository.saveRoom(room);
    resolveQuery();
    sql.pool.query = async (_query, values) => { writes.push(JSON.parse(values[1])); };
    await retry; await metadataSave;
    assert.equal(await roomRepository.getRoom(room.code), room, 'canonical room identity survives commit');
    assert.equal(room.stateVersion, before.stateVersion + 1);
    assert.equal(room.players[1].socketId, 'rejoined'); assert.equal(room.chatMessages[0].id, 'concurrent');
    assert.equal(writes.at(-1).stateVersion, room.stateVersion, 'queued metadata cannot overwrite committed game state');
    await assert.rejects(service.handleCommand(room.code, command), /지난 상태/);
    service.clearTimers(room.code);
    scenarios.push({ scenario: 'SQL reject/deferred commit: unchanged canonical state; original retry once; concurrent membership/chat preserved', passed: true });
    const appendChat = id => current => ({ chatMessages: [...current.chatMessages, { id, text: id }] });
    let releaseChat;
    sql.pool.query = async () => { await new Promise(resolve => { releaseChat = resolve; }); };
    const firstChat = roomRepository.saveRoom(room, appendChat('first'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(room.chatMessages.length, 1, 'chat is unpublished during SQL');
    room.chatMessages.push({ id: 'system', text: 'concurrent join' });
    const secondChat = roomRepository.saveRoom(room, appendChat('second'));
    const joinedMetadata = roomRepository.saveRoom(room);
    releaseChat();
    sql.pool.query = async (_query, values) => { writes.push(JSON.parse(values[1])); };
    await Promise.all([firstChat, secondChat, joinedMetadata]);
    assert.deepEqual(room.chatMessages.map(message => message.id), ['concurrent', 'system', 'first', 'second']);
    assert.deepEqual(writes.at(-1).chatMessages, room.chatMessages, 'queued chat/system writes converge durably');
    sql.pool.query = async () => { throw new Error('delete SQL outage'); };
    await assert.rejects(sql.deleteRoom(room.code), /delete SQL outage/);
    assert.equal(await sql.getRoom(room.code), room, 'failed SQL delete retains canonical cache');
    sql.pool.query = async (_query, values) => { writes.push(JSON.parse(values[1])); };
    scenarios.push({ scenario: 'serialized SQL chat preserves concurrent system append; failed delete keeps cache', passed: true });
    for (const recover of [true, false]) {
      mock.timers.enable({ apis: ['setTimeout', 'Date'] });
      try {
        const botRoom = { code: recover ? 'BOTRECOVER' : 'BOTBOUND', gameType: 'WHITEHALL', hostId: 'a', hostRole: 'JACK', gameState: 'LOBBY', turnTimeLimit: 0,
          players: ['a', 'b'].map(id => ({ id, nickname: id, isReady: true, isBot: id === 'a', socketId: null })) };
        await roomRepository.saveRoom(botRoom); await service.startMatch(botRoom.code, 'a');
        const version = botRoom.stateVersion;
        let attempts = 0;
        sql.pool.query = async () => { attempts++; if (!recover || attempts < 3) throw new Error('scheduled SQL outage'); };
        for (const delay of [600, 1000, 2000, 4000]) {
          mock.timers.tick(delay); await new Promise(resolve => setImmediate(resolve));
          if (attempts < 3 || !recover) assert.equal(botRoom.stateVersion, version, 'failed bot action leaves version unchanged');
        }
        assert.equal(attempts, recover ? 3 : 4, 'retry count is bounded and backoff does not spin');
        assert.equal(botRoom.stateVersion, version + (recover ? 1 : 0));
        assert.equal(service.timers.has(botRoom.code), false, 'successful setup yields human turn; exhausted retry leaves no timer');
        mock.timers.tick(60_000); await new Promise(resolve => setImmediate(resolve));
        assert.equal(attempts, recover ? 3 : 4, 'no duplicate action after recovery or retry exhaustion');
        scenarios.push({ scenario: recover ? 'scheduled bot recovers on third SQL attempt exactly once' : 'permanent scheduled SQL outage stops after four attempts without spin', passed: true });
      } finally {
        mock.timers.reset();
        sql.pool.query = async (_query, values) => { writes.push(JSON.parse(values[1])); };
      }
    }
  } finally { roomRepository.saveRoom = originalSave; await sql.close(); }
  for (const type of Object.keys(boardGameCores)) {
    const room = { code: type, gameType: type, hostId: 'a', hostRole: 'JACK', gameState: 'LOBBY', maxPlayers: 3, turnTimeLimit: 60,
      players: ['a', 'b', 'c'].map(id => ({ id, nickname: id, isReady: true, socketId: id })) };
    await roomRepository.saveRoom(room); await service.startMatch(room.code, 'a');
    assert.ok(room.boardPresentationGate);
    room.players[0].isDisconnected = true; room.players[0].socketId = null;
    await service.pauseRoom(room.code, 'a');
    room.players[1].isDisconnected = true; room.players[1].socketId = null;
    await service.pauseRoom(room.code, 'b');
    room.players[0].isDisconnected = false; room.players[0].socketId = 'a';
    await service.resumeRoom(room.code); assert.equal(room.isPaused, true, 'one return cannot unpause multiple missing users');
    const role = room.gameStateObject.jackPlayerId;
    room.pauseExpiresAt = Date.now() - 1;
    await service.disconnectExpired(room.code);
    assert.equal(room.isPaused, false); assert.equal(room.players[1].isBot, true);
    assert.equal(room.gameStateObject.players[1].isBot, true); assert.equal(room.gameStateObject.jackPlayerId, role);
    service.clearTimers(room.code);
    const persisted = clonePersistable(room), recovered = restoreRoom(persisted);
    assert.ok(recovered.players.every(p => p.socketId === null));
    assert.equal(recovered.isPaused, true); assert.equal(recovered.players[1].isDisconnected, false);
    recovered.boardPresentationGate = { id: 'old', waitingFor: ['a'], events: [{ type: 'OLD' }] };
    await roomRepository.saveRoom(recovered); await service.restoreRooms();
    assert.equal(recovered.boardPresentationGate, null); assert.ok(service.pauseTimers.has(room.code));
    const departure = await service.finalizeDeparture(room.code, 'a');
    assert.equal(departure.retainSeat, true); assert.equal(recovered.isPaused, true, 'departure preserves another missing player pause');
    assert.equal(recovered.gameStateObject.jackPlayerId, role, 'takeover preserves Jack seat');
    await service.finalizeDeparture(room.code, 'c');
    assert.equal(await roomRepository.getRoom(room.code), null);
    assert.equal(service.pauseTimers.has(room.code), false); assert.equal(service.timers.has(room.code), false);
    scenarios.push({ scenario: `${type}: multiple disconnects, expiry AI takeover, persisted restart, departure and teardown`, passed: true });
  }
  fs.mkdirSync('output/new-games', { recursive: true });
  fs.writeFileSync('output/new-games/recovery.json', JSON.stringify({ invocation: 'node tests/new_games_recovery.test.js', scenarios }, null, 2));
  console.log('New games recovery scenarios passed');
} finally {
  for (const room of await roomRepository.listRooms()) { service.clearTimers(room.code); service.clearPauseTimer(room.code); await roomRepository.deleteRoom(room.code); }
}
