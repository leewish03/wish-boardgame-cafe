import { circleById } from './map.js';
import { pawnIds, assertRule, currentPawn, legalActions, pendingActors, jackMoves, advancePawn, resolveTurn, endGame } from './rules.js';
export { chooseBotCommand } from './ai.js';
export { getPublicView, getPrivateView, getBotObservation, projectEvents } from './views.js';
export { pendingActors as getPendingActors } from './rules.js';
export const gameType = 'WHITEHALL';
export const minPlayers = 2;
export const maxPlayers = 4;
export const allowedCommands = ['START_MATCH', 'SET_DISCOVERIES', 'DEPLOY', 'CHOOSE_START', 'JACK_MOVE', 'POLICE_MOVE', 'SEARCH', 'ARREST', 'END_ACTION'];

export function createInitialState(players, config = {}, seed = 1) {
  assertRule(Array.isArray(players) && players.length >= 2 && players.length <= 4, '화이트홀은 2~4명이 필요합니다.');
  assertRule(players.every(p => typeof p.id === 'string' && p.id.length) && new Set(players.map(p => p.id)).size === players.length, '참가자 ID가 올바르지 않습니다.');
  const host = players.find(p => p.isHost) ?? players[0];
  const jackPlayerId = config.jackPlayerId ?? host.id;
  assertRule(players.some(p => p.id === jackPlayerId), '잭은 참가자 중에서 선택해야 합니다.');
  const detectives = players.filter(p => p.id !== jackPlayerId);
  return { gameType, matchState: 'LOBBY', playPhase: 'LOBBY', roundNumber: 1, stateVersion: 0,
    players: players.map(p => ({ id: p.id, nickname: p.nickname ?? p.id, isHost: p.id === host.id, isBot: !!p.isBot, role: p.id === jackPlayerId ? 'JACK' : 'POLICE' })),
    config: { jackPlayerId }, jackPlayerId, outcome: null, seed: Number(seed) >>> 0,
    police: pawnIds.map((id, i) => ({ id, controllerId: detectives[i % detectives.length].id, position: null })),
    pawnIndex: 0, discoveries: [], revealed: [], position: null, route: [], moveCount: 0,
    specials: { COACH: 2, ALLEY: 2, BOAT: 2 }, clues: [], searched: [], history: [] };
}

export function getAutomaticCommand(state) {
  if (state.matchState !== 'PLAYING') return null;
  if (state.playPhase === 'RESOLVE_TURN') return { type: 'RESOLVE_TURN' };
  if (state.playPhase === 'JACK_MOVE' && jackMoves(state).length === 0) return { type: 'TRAPPED' };
  return null;
}

export function executeCommand(input, command) {
  assertRule(command && typeof command.type === 'string', '명령이 올바르지 않습니다.');
  const state = structuredClone(input), events = [], actorId = command.playerId;
  if (command.type === 'START_MATCH') {
    assertRule(state.matchState === 'LOBBY' && state.players.some(p => p.id === actorId && p.isHost), '방장만 대기 중인 게임을 시작할 수 있습니다.');
    state.matchState = 'PLAYING'; state.playPhase = 'SET_DISCOVERIES';
    events.push({ type: 'MATCH_STARTED', actorId });
  } else if (['RESOLVE_TURN', 'TRAPPED'].includes(command.type)) {
    assertRule(getAutomaticCommand(state)?.type === command.type, '자동 진행 단계가 아닙니다.');
    if (command.type === 'TRAPPED') endGame(state, 'POLICE', 'TRAPPED', events);
    else resolveTurn(state, events);
  } else {
    assertRule(allowedCommands.includes(command.type) && pendingActors(state).includes(actorId), '현재 행동할 수 없는 참가자입니다.');
    const legal = legalActions(state, actorId);
    switch (command.type) {
      case 'SET_DISCOVERIES': {
        const ids = command.locations;
        assertRule(state.playPhase === 'SET_DISCOVERIES' && Array.isArray(ids) && ids.length === 4 && ids.every(id => Number.isInteger(id) && circleById[id]?.color === 'white') && new Set(ids.map(id => circleById[id].quadrant)).size === 4, '각 구역에서 흰색 발견 장소를 하나씩 선택하세요.');
        state.discoveries = [...ids]; state.playPhase = 'DEPLOY';
        events.push({ type: 'DISCOVERIES_CHOSEN', actorId });
        break;
      }
      case 'DEPLOY':
      case 'POLICE_MOVE': {
        assertRule(state.playPhase === command.type && command.pawnId === legal.pawnId && legal.destinations.includes(command.to), '이 수사관은 그 교차로로 이동할 수 없습니다.');
        const pawn = currentPawn(state), from = pawn.position;
        pawn.position = command.to;
        events.push({ type: command.type === 'DEPLOY' ? 'POLICE_DEPLOYED' : 'POLICE_MOVED', actorId, pawnId: pawn.id, from, to: pawn.position });
        advancePawn(state);
        break;
      }
      case 'CHOOSE_START':
        assertRule(state.playPhase === 'CHOOSE_START' && legal.startLocations.includes(command.to), '선택한 발견 장소에서 출발하세요.');
        state.position = command.to; state.revealed = [command.to]; state.route = [command.to]; state.playPhase = 'JACK_MOVE';
        events.push({ type: 'DISCOVERY_REVEALED', actorId, location: command.to });
        break;
      case 'JACK_MOVE': {
        assertRule(state.playPhase === 'JACK_MOVE' && Array.isArray(command.path), '잭의 이동 단계가 아닙니다.');
        const move = legal.moves.find(m => m.mode === command.mode && m.path.length === command.path.length && m.path.every((id, i) => id === command.path[i]));
        assertRule(move, '허용되지 않는 이동 경로입니다.');
        const from = state.position;
        state.route.push(...move.path); state.position = move.path.at(-1); state.moveCount += move.path.length;
        if (move.mode !== 'WALK') state.specials[move.mode]--;
        const evidence = { type: 'JACK_MOVED', actorId, mode: move.mode, moveCount: state.moveCount, blockedCrossings: state.police.map(p => p.position) };
        state.history.push(evidence); events.push(evidence);
        events.push({ type: 'JACK_ROUTE', recipientId: actorId, actorId, from, path: [...move.path], mode: move.mode });
        state.playPhase = 'POLICE_MOVE'; state.pawnIndex = 0;
        break;
      }
      case 'SEARCH':
      case 'ARREST':
      case 'END_ACTION': {
        assertRule(state.playPhase === 'POLICE_ACTION' && command.pawnId === legal.pawnId, '이 수사관의 조사 단계가 아닙니다.');
        if (command.type === 'END_ACTION') { assertRule(legal.canEnd, '단서를 찾거나 인접 장소를 모두 조사할 때까지 수색을 계속하세요.'); events.push({ type: 'ACTION_ENDED', actorId, pawnId: command.pawnId }); advancePawn(state); break; }
        assertRule((command.type === 'SEARCH' ? legal.searchTargets : legal.arrestTargets).includes(command.to), '조사할 수 없는 장소입니다.');
        const found = command.type === 'SEARCH' ? state.route.includes(command.to) : state.position === command.to;
        const evidence = { type: command.type === 'SEARCH' ? 'CLUE_SEARCHED' : 'ARREST_ATTEMPTED', actorId, pawnId: command.pawnId, location: command.to, found, moveCount: state.moveCount };
        state.history.push(evidence); events.push(evidence);
        if (command.type === 'ARREST') {
          if (found) endGame(state, 'POLICE', 'ARREST', events);
          else advancePawn(state);
        } else {
          state.searched.push(command.to);
          if (found && !state.clues.includes(command.to)) state.clues.push(command.to);
          if (found || legal.searchTargets.length === 1) advancePawn(state);
        }
        break;
      }
      default: throw new Error('지원하지 않는 명령입니다.');
    }
  }
  state.stateVersion++;
  return { nextState: state, events };
}
