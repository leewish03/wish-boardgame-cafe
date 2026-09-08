import assert from 'node:assert/strict';
import { core, loadTs } from './load_core.js';
import { roomRepository } from '../server/core/RoomRepository.js';
import { createLoveLetterService } from '../server/core/LoveLetterService.js';
const { buildPhysicalSequence } = loadTs('packages/protocol/src/physicalSequence.ts');
const emitted = [];
const service = createLoveLetterService({ to: recipient => ({ emit: (name, payload) => emitted.push({ recipient, name, payload }) }) }, { broadcastRoomState: () => {} });
const card = (value, id) => ({ ...core.CARD_DEFINITIONS[value], value, id });
async function fixture(value) {
  service.clearResolutionTimer('PHYSICAL');
  const players = [0,1,2].map(i => ({ id: `p${i}`, nickname: `Player ${i}`, socketId: `socket${i}` }));
  const state = core.createInitialGameState(players, { turnTimeoutSeconds: 0 });
  Object.assign(state, { matchState: 'PLAYING', playPhase: 'TURN_INPUT', roundNumber: 1, currentTurnPlayerId: 'p0' });
  state.players.forEach((p,i) => { state.secrets[p.id].hand = [card(i === 1 ? 6 : 4, `held${i}`)]; p.cardCount = 1; });
  state.secrets.p0.hand.unshift(card(value, 'played')); state.players[0].cardCount = 2;
  state.deck = [card(1,'deck1'),card(2,'deck2')];
  const room = { code: 'PHYSICAL', players, hostId: 'p0' };
  service.applyGameStateToRoom(room,state); await roomRepository.saveRoom(room);
  return room;
}
try {
  let room = await fixture(2);
  const deckBefore = room.gameStateObject.deck.length;
  await service.handleCommand(room.code,{ type:'PLAY_CARD',playerId:'p0',cardId:'played',targetId:'p1' });
  assert.equal(room.gameStateObject.playPhase,'ACTION_RESOLVING');
  assert.equal(room.gameStateObject.currentTurnPlayerId,'p0');
  assert.equal(room.gameStateObject.deck.length,deckBefore,'No next-turn draw before return');
  let pending = room.pendingResolution;
  const args = [room.code,'p0',pending.actionId,pending.stateVersion];
  assert.equal(service.resolutionTimers.has(room.code),false,'Human review has no expiry timer');
  pending.maxAdvanceAt = Date.now()-20_000;
  await service.schedulePendingResolution(room.code);
  assert.equal(service.resolutionTimers.has(room.code),false,'Even a passed legacy deadline cannot expire private review');
  assert.equal((await service.acknowledgePresentation(...args,'PRIVATE_REVIEW')).success,false);
  assert.equal((await service.acknowledgePresentation(room.code,'p1',pending.actionId,pending.stateVersion,'RETURN_REQUEST')).success,false);
  await assert.rejects(service.handleCommand(room.code,{type:'PLAY_CARD',playerId:'p0',cardId:'held0'}));
  const actor = service.presentationForPlayer(room,'p0');
  const observer = service.presentationForPlayer(room,'p2');
  assert.ok(actor.events.find(e=>e.event.type==='PRIEST_USED').event.revealedCard);
  assert.equal(JSON.stringify(observer).includes('held1'),false,'No target card identity or face in observer payload');
  assert.deepEqual(buildPhysicalSequence(actor.events).map(s=>s.kind),['PLAY','TARGET','BORROW','REVIEW','CONCEAL','RETURN','HOLD','CLEANUP']);
  assert.equal((await service.acknowledgePresentation(...args,'RETURN_REQUEST')).success,true);
  assert.equal((await service.acknowledgePresentation(...args,'RETURN_REQUEST')).success,true);
  assert.equal(emitted.filter(e=>e.name==='game:presentation-return').length,1,'Duplicate return emits once');
  assert.equal(service.presentationForPlayer(room,'p0').returnRequested,true,'Reconnect preserves return');
  assert.equal((await service.acknowledgePresentation(...args,'PRIVATE_REVIEW')).success,true);
  await service.finalizePendingResolution(room.code,pending.actionId);
  assert.equal(room.gameStateObject.currentTurnPlayerId,'p1');
  assert.equal(room.gameStateObject.deck.length,deckBefore-1);
  for (const value of [1,3,4,5,6,7,8]) {
    room = await fixture(value);
    await service.handleCommand(room.code,{type:'PLAY_CARD',playerId:'p0',cardId:'played',targetId:[1,3,5,6].includes(value)?'p1':undefined,guessValue:value===1?6:undefined});
    const steps = buildPhysicalSequence(service.presentationForPlayer(room,'p0').events);
    assert.equal(steps[0].kind,'PLAY'); assert.equal(steps.at(-1).kind,'CLEANUP');
    if(value===3) {
      assert.ok(steps.some(s=>s.kind==='COMPARE_REVIEW'));
      assert.equal(service.presentationForPlayer(room,'p2').events.find(e=>e.event.type==='BARON_COMPARED').event.comparisonHands,undefined);
    }
    if(value===5) assert.ok(steps.findIndex(s=>s.kind==='DISCARD_HAND')<steps.findIndex(s=>s.kind==='DRAW'));
    if(value===6) assert.equal(steps.filter(s=>s.kind==='SWAP').length,1);
    if(value===8) assert.equal(room.gameStateObject.secrets.p0.hand.length,0);
  }
  room = await fixture(2);
  await service.handleCommand(room.code,{type:'PLAY_CARD',playerId:'p0',cardId:'played',targetId:'p1'});
  const cancelled = room.pendingResolution.actionId;
  await service.handleCommand(room.code,{type:'FORFEIT',playerId:'p2'});
  assert.equal(room.pendingResolution,null,'Forfeit cancels the presentation gate');
  assert.equal(room.gameStateObject.playPhase,'TURN_INPUT','An unrelated departure cannot leave a resolving turn stuck');
  assert.equal((await service.acknowledgePresentation(room.code,'p0',cancelled,undefined,'RETURN_REQUEST')).success,false);
  console.log('Physical presentation: deferred turn, indefinite private review, return authorization/idempotency, privacy and all eight card sequences passed.');
} finally {
  service.clearResolutionTimer('PHYSICAL'); service.turnCoordinator.clearTurnTimer('PHYSICAL'); service.clearBotTimer('PHYSICAL');
  await roomRepository.deleteRoom('PHYSICAL');
}
