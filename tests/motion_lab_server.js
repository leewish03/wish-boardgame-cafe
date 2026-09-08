// Explicit local-only fixture process. Never imported by the application server.
import http from 'node:http';
import { Server } from 'socket.io';
import { core } from './load_core.js';
import { roomRepository } from '../server/core/RoomRepository.js';
import { createLoveLetterService } from '../server/core/LoveLetterService.js';
const httpServer = http.createServer();
const io = new Server(httpServer, { cors: { origin: /^http:\/\/(localhost|127\.0\.0\.1):3000$/ } });
const service = createLoveLetterService(io, { broadcastRoomState: () => {} });
const names = ['알렉산더', '줄리앙', '카밀', '루이', '마리', '엘리자'];
let revision = 10;
const card = (value, id) => ({ ...core.CARD_DEFINITIONS[value], value, id });
io.on('connection', socket => {
  socket.on('lab:join', async ({ playerId }, callback) => {
    socket.data.playerId = playerId;
    socket.join('MOTION');
    const room = await roomRepository.getRoom('MOTION');
    const player = room?.players.find(p => p.id === playerId);
    if (player) { player.socketId = socket.id; service.broadcastGameSnapshot('MOTION', room); }
    callback?.({ success: true });
  });
  socket.on('lab:reset', async ({ value = 2, count = 4 }, callback) => {
    revision = Math.max(revision, (await roomRepository.getRoom('MOTION'))?.gameStateObject?.stateVersion || 0);
    service.clearResolutionTimer('MOTION'); service.clearRoundAdvanceTimer('MOTION');
    const players = names.slice(0, count).map((nickname, i) => ({ id: `p${i}`, nickname, isHost: i === 0, isReady: true }));
    const state = core.createInitialGameState(players, { turnTimeoutSeconds: 0, targetTokens: 4 });
    Object.assign(state, { matchState: 'PLAYING', playPhase: 'TURN_INPUT', roundNumber: 1, currentTurnPlayerId: 'p0', stateVersion: ++revision });
    state.players.forEach((p, i) => { state.secrets[p.id].hand = [card(i === 0 ? 4 : i === 1 ? 6 : 1, `held-${revision}-${i}`)]; p.cardCount = 1; });
    state.secrets.p0.hand.unshift(card(value, `play-${revision}`)); state.players[0].cardCount = 2;
    state.deck = [1, 2, 3, 4, 5].map((v, i) => card(v, `deck-${revision}-${i}`));
    state.setAsideCard = card(1, `aside-${revision}`);
    const room = { code: 'MOTION', hostId: 'p0', players, maxPlayers: count, targetTokens: 4, turnTimeLimit: 0 };
    for (const connected of io.sockets.sockets.values()) {
      const p = players.find(p => p.id === connected.data.playerId); if (p) p.socketId = connected.id;
    }
    service.applyGameStateToRoom(room, state); await roomRepository.saveRoom(room);
    service.broadcastGameSnapshot('MOTION', room); callback?.({ success: true });
  });
  socket.on('game:command', async (payload, callback) => {
    try { await service.handleCommand('MOTION', { ...payload.command, playerId: socket.data.playerId }); callback({ success: true }); }
    catch (error) { callback({ success: false, error: error.message }); }
  });
  socket.on('game:presentation-ack', async (payload, callback) => callback(await service.acknowledgePresentation('MOTION', socket.data.playerId, payload.actionId, payload.expectedStateVersion, payload.completedPhase)));
});
httpServer.listen(3002, '127.0.0.1', () => console.log('Motion fixture server: 127.0.0.1:3002'));
