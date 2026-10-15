// Explicit local QA fixture: deterministic setup, real recipient projections and commands.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { Server } from 'socket.io';
assert.equal(Boolean(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL), false, 'Fixture requires memory persistence');
const { core } = await import('./load_core.js');
const { roomRepository } = await import('../server/core/RoomRepository.js');
const { createLoveLetterService, SOCKET_EVENTS } = await import('../server/core/LoveLetterService.js');
const server = http.createServer();
const io = new Server(server, { cors: { origin: /^http:\/\/(localhost|127\.0\.0\.1):3000$/ } });
const code = 'TASK9';
const service = createLoveLetterService(io, { broadcastRoomState: () => {} });
let revision = 100;
let round = 1;
const card = (value, id) => ({ ...core.CARD_DEFINITIONS[value], value, id });
const snapshot = async () => { const room = await roomRepository.getRoom(code); if (room) service.broadcastGameSnapshot(code, room); };
const reply = callback => async operation => { try { const result = await operation(); callback?.(result || { success: true }); } catch (error) { callback?.({ success: false, error: error.message }); } };
io.on('connection', socket => {
  socket.on('fixture:join', async ({ playerId }) => {
    if (!['p0', 'p1', 'p2'].includes(playerId)) return;
    socket.data.playerId = playerId; socket.join(code);
    const room = await roomRepository.getRoom(code);
    const player = room?.players.find(p => p.id === playerId);
    if (player) { player.socketId = socket.id; await roomRepository.saveRoom(room); }
    await snapshot();
  });
  socket.on('fixture:reset', ({ value = 2, terminal = 'none' }, callback) => reply(callback)(async () => {
    if (socket.data.playerId !== 'p0') throw Error('Host fixture control only');
    const old = await roomRepository.getRoom(code);
    revision = Math.max(revision, old?.gameStateObject?.stateVersion || 0) + 1;
    service.clearResolutionTimer(code); service.clearRoundAdvanceTimer(code); service.clearTurnPresentationTimer(code);
    const count = terminal === 'none' ? 3 : 2;
    const players = ['진행자', '상대', '관전자'].slice(0, count).map((nickname, i) => ({ id: `p${i}`, nickname, isHost: i === 0, isReady: true }));
    const state = core.createInitialGameState(players, { turnTimeoutSeconds: 0, targetTokens: terminal === 'match' ? 1 : 4 });
    Object.assign(state, { matchState: 'PLAYING', playPhase: 'TURN_INPUT', roundNumber: round++, currentTurnPlayerId: 'p0', stateVersion: revision });
    state.players.forEach((p, i) => { state.secrets[p.id].hand = [card(i === 0 ? 4 : i === 1 ? 6 : 1, `held-${revision}-${i}`)]; p.cardCount = 1; });
    state.secrets.p0.hand.unshift(card(value, `play-${revision}`)); state.players[0].cardCount = 2;
    state.deck = [1, 2, 3, 4, 5].map((v, i) => card(v, `deck-${revision}-${i}`));
    state.setAsideCard = card(1, `aside-${revision}`);
    const room = { code, hostId: 'p0', players, maxPlayers: count, targetTokens: terminal === 'match' ? 1 : 4, turnTimeLimit: 0 };
    for (const connected of io.sockets.sockets.values()) { const p = players.find(p => p.id === connected.data.playerId); if (p) p.socketId = connected.id; }
    service.applyGameStateToRoom(room, state); await roomRepository.saveRoom(room); await snapshot();
  }));
  socket.on(SOCKET_EVENTS.GAME_COMMAND, (payload, callback) => reply(callback)(() => service.handleCommand(code, { ...payload.command, playerId: socket.data.playerId })));
  socket.on(SOCKET_EVENTS.GAME_PRESENTATION_ACK, (p, callback) => {
    socket.data.lastAcknowledgment = p;
    reply(callback)(() => service.acknowledgePresentation(code, socket.data.playerId, p.actionId, p.expectedStateVersion, p.completedPhase, p.roundNumber));
  });
  socket.on('fixture:replay-ack', (_, callback) => reply(callback)(async () => {
    const p = socket.data.lastAcknowledgment;
    if (!p) throw Error('아직 저장된 완료 확인이 없습니다.');
    return service.acknowledgePresentation(code, socket.data.playerId, p.actionId, p.expectedStateVersion, p.completedPhase, p.roundNumber);
  }));
  socket.on(SOCKET_EVENTS.GAME_ADVANCE, (p, callback) => reply(callback)(() => service.advanceRound(code, socket.data.playerId, p.expectedStateVersion, p.requestId)));
  socket.on(SOCKET_EVENTS.GAME_REMATCH, (p, callback) => reply(callback)(() => service.startRematch(code, socket.data.playerId, p.expectedStateVersion, p.requestId)));
  socket.on(SOCKET_EVENTS.GAME_VIEW_READY, snapshot);
});
server.listen(3114, '127.0.0.1', () => {
  fs.writeFileSync('.omo/evidence/ui-ux/task-9/fixture-process.json', JSON.stringify({ pid: process.pid, port: 3114, command: 'node tests/love_letter_motion_fixture_server.js', databaseEnvironmentAbsent: true }, null, 2));
  console.log(`Task9 memory fixture listening on 127.0.0.1:3114 PID ${process.pid}`);
});
