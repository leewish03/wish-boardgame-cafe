import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { initRoomManager, configureGameLifecycle, rooms } from '../server/shared/roomManager.js';
import { BoardGameService, boardGameCores } from '../server/core/BoardGameService.js';
import { registerBoardGameController } from '../server/games/boardGameController.js';
import { roomRepository } from '../server/core/RoomRepository.js';

const server = http.createServer(), io = new Server(server);
const service = new BoardGameService(io), clients = [], artifacts = [];
initRoomManager(io); registerBoardGameController(io, service);
for (const type of Object.keys(boardGameCores)) configureGameLifecycle(type, {
  pause: (code, id) => service.pauseRoom(code, id), resume: code => service.resumeRoom(code),
  disconnectExpired: code => service.disconnectExpired(code), forfeit: (code, id) => service.finalizeDeparture(code, id),
  projectPublicState: (room, id) => service.projectRoomState(room, id),
});
const emit = (client, event, payload = {}) => new Promise((resolve, reject) => {
  client.timeout(5000).emit(event, payload, (error, result) => error ? reject(error) : resolve(result));
});
const until = async predicate => {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.fail('Observable state did not settle within one second');
};
await new Promise(resolve => server.listen(0, resolve));
async function connect() {
  const client = Client(`http://127.0.0.1:${server.address().port}`, { transports: ['websocket'] });
  clients.push(client);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Socket connection timed out: ${client.io.engine?.transport?.name}`)), 5000);
    client.once('connect', () => { clearTimeout(timeout); resolve(); });
    client.once('connect_error', error => { clearTimeout(timeout); reject(error); });
  });
  return client;
}
async function create(type, hostRole = 'JACK') {
  const a = await connect(), b = await connect();
  const created = await emit(a, 'room:create', { gameType: type.toLowerCase(), nickname: 'A', maxPlayers: 2, turnTimeLimit: 0, hostRole });
  assert.ok(created.success);
  const joined = await emit(b, 'room:join', { roomCode: created.roomCode, nickname: 'B' });
  assert.ok(joined.success);
  const code = created.roomCode, ids = [created.userId, joined.userId], peers = new Map([[ids[0], a], [ids[1], b]]);
  assert.equal((await emit(b, 'board:start', { roomCode: code })).success, false);
  assert.equal((await emit(a, 'board:start', { roomCode: code })).success, false, 'unready participant prevents start');
  assert.ok((await emit(b, 'room:ready', { roomCode: code })).success);
  rooms[code].seed = Date.now();
  assert.ok((await emit(a, 'board:start', { roomCode: code })).success);
  async function ack() {
    const gate = rooms[code]?.boardPresentationGate;
    if (!gate) return;
    for (const id of gate.waitingFor) peers.get(id).emit('board:presentation-ack', { roomCode: code, eventId: gate.id });
    await until(() => !rooms[code].boardPresentationGate);
  }
  async function command(id, command, expectedVersion = rooms[code].stateVersion) {
    return emit(peers.get(id), 'board:command', { roomCode: code, expectedVersion, command });
  }
  return { code, ids, peers, a, b, created, joined, ack, command };
}
try {
  const chatClient = await connect();
  const chatRoom = await emit(chatClient, 'room:create', { gameType: 'WHITEHALL', nickname: 'Chat sender' });
  const chatMessages = [];
  chatClient.on('chat:message', message => chatMessages.push(message));
  const save = roomRepository.saveRoom;
  try {
    roomRepository.saveRoom = async () => { throw new Error('chat persistence unavailable'); };
    const failed = await emit(chatClient, 'chat:message', { roomCode: chatRoom.roomCode, text: 'retry me' });
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(failed.success, false, 'failed durable chat returns failure ACK');
    assert.equal(chatMessages.length, 0, 'failed chat is never broadcast');
    assert.ok(!(rooms[chatRoom.roomCode].chatMessages || []).some(message => message.text === 'retry me'));
    roomRepository.saveRoom = save;
    assert.equal((await emit(chatClient, 'chat:message', { roomCode: chatRoom.roomCode, text: 'retry me' })).success, true);
    await until(() => chatMessages.length === 1);
    assert.equal(rooms[chatRoom.roomCode].chatMessages.filter(message => message.text === 'retry me').length, 1);
    artifacts.push({ scenario: 'real chat handler survives rejected save, failure ACK, retry has one durable message and broadcast', passed: true });
    console.log('Chat persistence failure/retry process-survival scenario passed');
  } finally { roomRepository.saveRoom = save; }
  const sixClient = await connect();
  const sixRoom = await emit(sixClient, 'room:create', { gameType:'SIX_NIMMT', nickname:'Six player deck', maxPlayers:6, turnTimeLimit:0 });
  assert.ok(sixRoom.success);
  for (let i=0;i<5;i++) assert.ok((await emit(sixClient,'room:add-bot',{roomCode:sixRoom.roomCode})).success);
  assert.ok((await emit(sixClient,'board:start',{roomCode:sixRoom.roomCode})).success);
  const sixState=rooms[sixRoom.roomCode].gameStateObject;
  assert.equal(sixState.config.deckSize,64);
  assert.deepEqual([...Object.values(sixState.hands).flat(),...sixState.rows.flat()].sort((a,b)=>a-b),Array.from({length:64},(_,i)=>i+1));
  const sixView=service.projectRoomState(rooms[sixRoom.roomCode],sixRoom.userId);
  assert.equal(sixView.game.config.deckSize,64);
  assert.ok(sixView.mySecret.hand.every(card=>card<=64));
  assert.ok((await emit(sixClient,'room:leave',{roomCode:sixRoom.roomCode})).success);
  artifacts.push({scenario:'six-player socket match with five AI seats uses exactly cards 1 through 64',passed:true});
  const t = await create('SIX_NIMMT');
  const core = boardGameCores.SIX_NIMMT, room = rooms[t.code];
  const openingSeed = room.gameStateObject.seed;
  assert.match(openingSeed, /^[0-9a-f]{64}$/, 'live deals retain 256-bit crypto entropy');
  const dealtCards = JSON.stringify(room.gameStateObject.hands);
  const guessedPlayers = room.gameStateObject.players;
  for (let timestamp = room.seed - 1000; timestamp <= room.seed + 1000; timestamp++) {
    const guess = core.executeCommand(core.createInitialState(guessedPlayers, {}, timestamp), { type: 'START_MATCH', playerId: t.ids[0] }).nextState;
    assert.notEqual(JSON.stringify(guess.hands), dealtCards, 'timestamp guesses must not recover the complete private deal');
  }
  const version = room.stateVersion;
  assert.equal((await t.command(t.ids[0], { type: 'SELECT_CARD', card: room.gameStateObject.hands[t.ids[0]][0] })).success, false, 'opening gate blocks input');
  await t.ack();
  const viewA = service.projectRoomState(room, t.ids[0]), viewB = service.projectRoomState(room, t.ids[1]);
  assert.notDeepEqual(viewA.mySecret.hand, viewB.mySecret.hand);
  assert.equal('hands' in viewA.game, false); assert.equal('seed' in viewA.game, false);
  assert.equal((await emit(t.a, 'board:command', { roomCode: t.code, userId: t.ids[1], expectedVersion: version, command: { type: 'SELECT_CARD', card: viewB.mySecret.hand[0] } })).success, false);
  assert.equal((await t.command(t.ids[0], { type: 'STEP_RESOLVE' })).success, false);
  const simultaneous = await Promise.all(t.ids.map(id => t.command(id, { type: 'SELECT_CARD', playerId: 'forged', card: room.gameStateObject.hands[id][0] }, version)));
  assert.ok(simultaneous.every(result => result.success), JSON.stringify(simultaneous));
  assert.ok(room.boardPresentationGate); assert.equal(room.gameStateObject.playPhase, 'RESOLVING');
  assert.equal((await t.command(t.ids[0], { type: 'SELECT_CARD', card: viewA.mySecret.hand[0] }, version)).success, false);
  await t.ack();
  let steps = 0;
  while (room.gameState !== 'GAME_OVER' && steps++ < 4000) {
    await t.ack();
    const state = room.gameStateObject;
    if (core.getAutomaticCommand(state)) { await service.runScheduled(t.code, state.stateVersion); continue; }
    const id = core.getPendingActors(state)[0];
    const command = core.chooseBotCommand(core.getBotObservation(state, id), id);
    if (state.matchState === 'ROUND_END') assert.equal((await t.command(t.ids[1], command)).success, false, 'only host advances round');
    const result = await t.command(id, command);
    assert.ok(result.success, result.error);
  }
  assert.equal(room.gameState, 'GAME_OVER'); assert.ok(room.gameStateObject.outcome.winnerIds.length);
  const finishedVersion = room.stateVersion;
  await t.ack(); assert.ok((await emit(t.a, 'board:start', { roomCode: t.code })).success);
  assert.ok(room.stateVersion > finishedVersion, 'rematch preserves monotonic version');
  assert.notEqual(room.gameStateObject.seed, openingSeed, 'rematch gets independent secret entropy');
  artifacts.push({ scenario: '256-bit live shuffle entropy, 2001 timestamp guesses do not recover complete private deal, fresh rematch entropy', passed: true });
  artifacts.push({ scenario: 'Nimmt real sockets: identity, simultaneous epoch, duplicate, automatic gate, full match, rematch', passed: true, steps, rounds: room.roundNumber });

  for (const type of ['WHITECHAPEL', 'WHITEHALL']) {
    const t = await create(type, 'INVESTIGATOR'), room = rooms[t.code], core = boardGameCores[type];
    assert.equal(room.gameStateObject.jackPlayerId, t.ids[1]);
    await t.ack();
    const host = service.projectRoomState(room, t.ids[0]), jack = service.projectRoomState(room, t.ids[1]);
    assert.equal(host.hostRole, 'INVESTIGATOR'); assert.equal(jack.mySecret.role, 'JACK');
    assert.equal('position' in host.mySecret, false);
    const first = core.chooseBotCommand(core.getBotObservation(room.gameStateObject, t.ids[1]), t.ids[1]);
    assert.equal((await t.command(t.ids[0], first)).success, false, 'wrong role denied');
    assert.equal((await t.command(t.ids[1], first, room.stateVersion - 1)).success, false, 'stale version denied');
    assert.equal((await t.command(t.ids[1], { type: type === 'WHITEHALL' ? 'RESOLVE_TURN' : '_CHECK_BLOCKED' })).success, false);
    let movements = 0;
    for (let i = 0; i < 30 && room.gameState === 'PLAYING'; i++) {
      await t.ack();
      const state = room.gameStateObject, auto = core.getAutomaticCommand(state);
      if (auto) { await service.runScheduled(t.code, state.stateVersion); continue; }
      const id = core.getPendingActors(state)[0], command = core.chooseBotCommand(core.getBotObservation(state, id), id);
      assert.ok(command, `${type} pending actor has legal action`);
      const result = await t.command(id, command); assert.ok(result.success, result.error);
      const jackView = service.projectRoomState(room, t.ids[1]), policeView = service.projectRoomState(room, t.ids[0]);
      assert.equal('position' in policeView.mySecret, false); assert.equal('route' in policeView.game, false); assert.equal('trail' in policeView.game, false);
      assert.ok(policeView.presentation.events.every(event => !event.recipientId || event.recipientId === t.ids[0]));
      if (jackView.presentation.events.some(e => e.type === 'JACK_ROUTE')) {
        movements++; assert.ok(!policeView.presentation.events.some(e => e.type === 'JACK_ROUTE'));
      }
    }
    if (type === 'WHITEHALL') assert.ok(movements > 0, 'private movement event was exercised');
    const observed = new Promise(resolve => t.b.once('room:state', resolve));
    assert.ok((await emit(t.b, 'board:view-ready', { roomCode: t.code })).success);
    assert.equal((await observed).mySecret.role, 'JACK');
    artifacts.push({ scenario: `${type}: role assignment, exact versions, private setup and movement, view ready`, passed: true, movements });
  }
  const outsider = await connect();
  const old = await emit(outsider, 'room:create', { gameType: 'LOVE_LETTER' });
  assert.equal((await emit(outsider, 'board:start', { roomCode: old.roomCode })).success, false);
  fs.mkdirSync('output/new-games', { recursive: true });
  fs.writeFileSync('output/new-games/socket.json', JSON.stringify({ invocation: 'node tests/new_games_socket.test.js', artifacts }, null, 2));
  console.log('New games real socket scenarios passed');
} finally {
  for (const code of Object.keys(rooms)) { service.clearTimers(code); service.clearPauseTimer(code); delete rooms[code]; }
  clients.forEach(client => client.disconnect()); await new Promise(resolve => io.close(resolve));
}
