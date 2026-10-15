import { circleById, neighbors, groupDestinations, alleyGroups, waterGroups, policeDestinations, adjacentCircles, startingCrossings } from './map.js';

export const pawnIds = ['YELLOW', 'BLUE', 'RED'];
export const assertRule = (condition, message) => { if (!condition) throw new Error(message); };
export const currentPawn = state => state.police[state.pawnIndex];
export const isNewDiscovery = (state, id) => state.discoveries.includes(id) && !state.revealed.includes(id);

export function jackMoves(state) {
  const from = state.position, moves = [];
  if (state.moveCount >= 15 || from === null) return moves;
  const add = (mode, path) => moves.push({ mode, path });
  for (const to of neighbors(from, 'JACK', state.police.map(p => p.position))) add('WALK', [to]);
  const allowedSpecial = id => !isNewDiscovery(state, id);
  if (state.specials.ALLEY > 0) for (const to of groupDestinations(from, alleyGroups).filter(allowedSpecial)) add('ALLEY', [to]);
  if (state.specials.BOAT > 0) for (const to of groupDestinations(from, waterGroups).filter(allowedSpecial)) add('BOAT', [to]);
  if (state.specials.COACH > 0 && state.moveCount <= 13) {
    for (const via of neighbors(from, 'JACK').filter(id => circleById[id].color !== 'blue' && allowedSpecial(id))) {
      for (const to of neighbors(via, 'JACK').filter(id => id !== from && circleById[id].color !== 'blue' && allowedSpecial(id))) add('COACH', [via, to]);
    }
  }
  return moves;
}

export function legalActions(state, playerId) {
  if (!pendingActors(state).includes(playerId)) return {};
  switch (state.playPhase) {
    case 'SET_DISCOVERIES': return { discoveryQuadrants: ['NW', 'NE', 'SW', 'SE'] };
    case 'CHOOSE_START': return { startLocations: state.discoveries };
    case 'DEPLOY': return { pawnId: currentPawn(state).id, destinations: startingCrossings.filter(id => !state.police.some(p => p.position === id)) };
    case 'JACK_MOVE': return { moves: jackMoves(state) };
    case 'POLICE_MOVE': return { pawnId: currentPawn(state).id, destinations: policeDestinations(currentPawn(state), state.police) };
    case 'POLICE_ACTION': return { pawnId: currentPawn(state).id, searchTargets: adjacentCircles(currentPawn(state).position).filter(id => !state.searched.includes(id)), arrestTargets: state.searched.length ? [] : adjacentCircles(currentPawn(state).position), canEnd: state.searched.length === 0 };
    default: return {};
  }
}

export function pendingActors(state) {
  if (state.matchState !== 'PLAYING') return [];
  if (['SET_DISCOVERIES', 'CHOOSE_START', 'JACK_MOVE'].includes(state.playPhase)) return [state.jackPlayerId];
  if (['DEPLOY', 'POLICE_MOVE', 'POLICE_ACTION'].includes(state.playPhase)) return [currentPawn(state).controllerId];
  return [];
}

export function endGame(state, side, reason, events) {
  state.matchState = 'GAME_OVER'; state.playPhase = 'GAME_OVER';
  state.outcome = { winner: side, reason, winnerIds: state.players.filter(p => (p.id === state.jackPlayerId) === (side === 'JACK')).map(p => p.id) };
  events.push({ type: 'GAME_ENDED', ...state.outcome });
}

export function advancePawn(state) {
  state.searched = [];
  if (state.pawnIndex < 2) { state.pawnIndex++; return; }
  state.pawnIndex = 0;
  state.playPhase = { DEPLOY: 'CHOOSE_START', POLICE_MOVE: 'POLICE_ACTION', POLICE_ACTION: 'RESOLVE_TURN' }[state.playPhase];
}

export function resolveTurn(state, events) {
  if (isNewDiscovery(state, state.position)) {
    state.revealed.push(state.position);
    events.push({ type: 'DISCOVERY_REVEALED', actorId: state.jackPlayerId, location: state.position });
    if (state.revealed.length === 4) { endGame(state, 'JACK', 'ALL_DISCOVERIES', events); return; }
    state.roundNumber++; state.moveCount = 0; state.clues = []; state.route = [state.position]; state.history = [];
    events.push({ type: 'ROUND_STARTED', roundNumber: state.roundNumber, location: state.position });
  } else if (state.moveCount >= 15) { endGame(state, 'POLICE', 'TIME_EXPIRED', events); return; }
  state.playPhase = 'JACK_MOVE';
}
