import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { createRoomSessionBoundary, terminalSessionCode, sessionEndMessages } from '../src/shared/roomSession.js';

// Execute the actual App departure handler with held UI updates and a real transport.
const source = readFileSync(process.env.APP_LEAVE_SOURCE || 'src/App.jsx', 'utf8');
const handlerSource = source.slice(source.indexOf('  const handleLeaveRoom ='), source.indexOf('  const isHost = roomState'));
assert.ok(handlerSource.includes("'room:leave'"), 'load the active App handler');
const server = http.createServer();
const io = new Server(server);
const received = [], acknowledgements = [];
io.on('connection', socket => {
  for (const event of ['room:leave', 'room:forfeit']) socket.on(event, (payload, ack) => {
    received.push({ event, roomCode: payload.roomCode });
    acknowledgements.push(ack);
  });
  socket.on('test:barrier', ack => ack());
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const socket = connect(`http://127.0.0.1:${server.address().port}`, { transports: ['websocket'] });
await new Promise(resolve => socket.once('connect', resolve));
const barrier = () => new Promise((resolve, reject) => socket.timeout(2000).emit('test:barrier', error => error ? reject(error) : resolve()));
const roomSessionRef = { current: createRoomSessionBoundary() };
const departureGenerationRef = { current: null };
const timers = new Map();
let timerId = 0, prompt = null, screen = 'game', room = null, cleared = 0;
const update = (previous, value) => typeof value === 'function' ? value(previous) : value;
const scope = {
  socket, roomSessionRef, departureGenerationRef,
  currentUser: { id: 'actor' },
  loadSession: () => ({ sessionToken: 'fixture-only-session' }),
  invalidateRoomSession: () => roomSessionRef.current.invalidate(),
  clearSession: () => { cleared++; },
  setLeavePrompt: value => { prompt = update(prompt, value); },
  setReconnectOffer() {}, setCurrentUser() {}, setToastMessage() {},
  setRoomState: value => { room = value; }, setScreen: value => { screen = value; },
  terminalSessionCode, sessionEndMessages,
  window: { setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id) },
};
const render = (gameState, code = 'TABLE') => {
  room = { code, gameState };
  const values = { ...scope, roomState: room, leavePrompt: prompt };
  return new Function(...Object.keys(values), `${handlerSource}\nreturn handleLeaveRoom;`)(...Object.values(values));
};
const begin = code => {
  const request = roomSessionRef.current.begin(code, 'actor');
  roomSessionRef.current.accept(request, code, 'actor');
  prompt = null; screen = 'game';
};
try {
  begin('TABLE');
  let leave = render('GAME_OVER');
  leave({ immediate: true }); leave({ immediate: true });
  await barrier();
  console.log(JSON.stringify({ scenario: 'same-render immediate final exit', transport: received }));
  assert.equal(received.length, 1, 'repeated immediate final exit sends one room:leave over Socket.IO');
  assert.equal(received[0].event, 'room:leave');
  acknowledgements[0]({ success: true }); await barrier();
  assert.equal(screen, 'lobby'); assert.equal(cleared, 1);
  leave({ immediate: true }); await barrier();
  assert.equal(received.length, 1, 'stale callback after completion cannot send another leave');

  begin('TABLE');
  leave = render('PLAYING'); leave();
  assert.deepEqual(prompt, { roomCode: 'TABLE', pending: false });
  await barrier(); assert.equal(received.length, 1, 'opening confirmation sends nothing');
  leave = render('PLAYING'); leave({ immediate: true }); leave({ immediate: true });
  await barrier(); assert.equal(received.length, 2);
  assert.equal(received[1].event, 'room:forfeit');
  for (const timer of timers.values()) timer(); timers.clear();
  assert.equal(screen, 'lobby', 'missing ACK still leaves locally through existing fallback');
  assert.equal(cleared, 2);

  begin('NEW'); render('WAITING', 'NEW');
  acknowledgements[1]({ success: true }); await barrier();
  assert.equal(screen, 'game'); assert.equal(room.code, 'NEW');
  assert.equal(cleared, 2, 'old ACK cannot clear a new membership');
  leave = render('WAITING', 'NEW'); leave(); leave();
  await barrier(); assert.equal(received.length, 3, 'new membership receives its own departure');
  acknowledgements[2]({ success: false, code: 'ROOM_NOT_FOUND' }); await barrier();
  assert.equal(screen, 'lobby'); assert.equal(cleared, 3);
  console.log(JSON.stringify({ scenario: 'confirmation fallback late ACK new membership', transport: received, cleared }));
  console.log('PASS App departure: exactly-once real transport, confirmation, fallback, stale completion and new membership');
} finally {
  socket.disconnect();
  await new Promise(resolve => io.close(resolve));
}
