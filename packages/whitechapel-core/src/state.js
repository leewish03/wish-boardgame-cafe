import { jackDestinations, alleyDestinations, policeDestinations, inspectableNumbers, numbers, redNumbers, policeStarts } from './map.js';
export const colors = ['blue', 'yellow', 'brown', 'red', 'green'];
export const nightRules = [{ women: 8, real: 5, coach: 3, alley: 2 }, { women: 7, real: 4, coach: 2, alley: 2 }, { women: 6, real: 3, coach: 2, alley: 1 }, { women: 4, real: 1, coach: 1, alley: 1 }];
export function requireRule(condition, message) { if (!condition) throw new Error(message); }
export function finish(state, winner, reason) {
  state.matchState = 'GAME_OVER'; state.playPhase = 'FINISHED';
  state.outcome = { winner, reason, winnerIds: state.players.filter(p => (p.id === state.jackPlayerId) === (winner === 'JACK')).map(p => p.id) };
}
export function prepareNight(state) {
  const rule = nightRules[state.roundNumber - 1];
  state.matchState = 'PLAYING'; state.playPhase = 'PLACE_WOMEN';
  state.specials = { coach: rule.coach, alley: rule.alley };
  state.women = []; state.wretched = []; state.patrols = []; state.clues = []; state.searches = [];
  state.trail = []; state.position = null; state.wait = 1; state.track = 0; state.movementHistory = []; state.huntHistory = [];
  state.headColor = state.headOrder[state.roundNumber - 1];
  state.headPlayerId = state.police.find(p => p.id === state.headColor).ownerId;
  const detectives = state.players.filter(p => p.id !== state.jackPlayerId).map(p => p.id);
  const start = detectives.indexOf(state.headPlayerId);
  state.policeOrder = [...detectives.slice(start), ...detectives.slice(0,start)];
  state.pendingPolice = []; state.searched = {}; state.actionMode = {};
}
export function beginPolice(state, phase) {
  state.playPhase = phase;
  state.pendingPolice = state.policeOrder.flatMap(id => state.police.filter(p => p.ownerId === id).map(p => p.id));
  state.searched = {}; state.actionMode = {};
}
export function currentPolice(state) {
  const first = state.police.find(p => p.id === state.pendingPolice[0]);
  return first ? state.police.filter(p => p.ownerId === first.ownerId && state.pendingPolice.includes(p.id)) : [];
}
export function jackMoves(state) {
  if (state.track >= 15) return [];
  const moves = jackDestinations(state.position, state.police.map(p => p.position)).map(to => ({ type: 'JACK_MOVE', mode: 'normal', to }));
  if (state.specials.alley > 0) moves.push(...alleyDestinations(state.position).map(to => ({ type: 'JACK_MOVE', mode: 'alley', to })));
  if (state.specials.coach > 0 && state.track <= 13) for (const via of jackDestinations(state.position)) {
    for (const to of jackDestinations(via)) if (to !== state.position && to !== via) moves.push({ type: 'JACK_MOVE', mode: 'coach', via, to });
  }
  return moves;
}
export function wretchedMoves(state, from) {
  const patrolPositions = state.patrols.map(p => p.position);
  const forbidden = patrolPositions.flatMap(inspectableNumbers);
  const moves = jackDestinations(from, patrolPositions).filter(n => !state.wretched.includes(n) && !state.crimeScenes.includes(n) && !forbidden.includes(n));
  return moves.length ? moves : [from];
}
export function legalActions(state, playerId) {
  if (state.matchState === 'LOBBY') return { commands: state.players.find(p => p.id === playerId)?.isHost ? [{type:'START_MATCH'}] : [] };
  if (state.matchState === 'ROUND_END') return { commands: state.players.find(p => p.id === playerId)?.isHost ? [{type:'ADVANCE_ROUND'}] : [] };
  if (state.matchState !== 'PLAYING') return { commands: [] };
  const jack = playerId === state.jackPlayerId;
  const head = playerId === state.headPlayerId;
  switch (state.playPhase) {
    case 'CHOOSE_HIDEOUT': return { commands: jack ? numbers.filter(n => !redNumbers.includes(n)).map(to => ({type:'CHOOSE_HIDEOUT', to})) : [] };
    case 'PLACE_WOMEN': return { commands: [], ...(jack ? { womanNumbers: redNumbers.filter(n => !state.crimeScenes.includes(n)), ...nightRules[state.roundNumber-1] } : {}) };
    case 'PLACE_PATROLS': return { commands: [], ...(head ? { patrolRequired: state.roundNumber === 1 ? [] : state.police.map(p => p.position), patrolStarts: policeStarts, colors } : {}) };
    case 'KILL_OR_WAIT': {
      const commands = [];
      if (jack) {
        if (state.wait < 5) commands.push({type:'WAIT'});
        if (state.roundNumber === 3) for (const first of state.wretched) for (const second of state.wretched) { if (first !== second) commands.push({type:'MURDER', victims:[first,second]}); }
        else commands.push(...state.wretched.map(n => ({type:'MURDER', victims:[n]})));
      }
      return {commands};
    }
    case 'MOVE_WRETCHED': return { commands: head ? state.pendingWretched.flatMap(from => wretchedMoves(state, from).map(to => ({type:'MOVE_WRETCHED', from, to}))) : [] };
    case 'REVEAL_PATROL': return { commands: jack ? state.patrols.filter(p => !p.revealed).map(p => ({type:'REVEAL_PATROL', position:p.position})) : [] };
    case 'JACK_MOVE': return { commands: jack ? jackMoves(state) : [] };
    case 'POLICE_MOVE': return { commands: currentPolice(state).filter(p => p.ownerId === playerId).flatMap(p => policeDestinations(p.position, state.police.map(q => q.position)).map(to => ({type:'POLICE_MOVE', officerId:p.id, to}))) };
    case 'POLICE_ACTION': return { commands: currentPolice(state).filter(p => p.ownerId === playerId).flatMap(p => {
      const adjacent = inspectableNumbers(p.position);
      const commands = adjacent.filter(n => !(state.searched[p.id] || []).includes(n)).map(to => ({type:'SEARCH', officerId:p.id,to}));
      if (!state.actionMode[p.id]) commands.push(...adjacent.map(to => ({type:'ARREST',officerId:p.id,to})), {type:'PASS',officerId:p.id});
      return commands;
    }) };
    default: return {commands:[]};
  }
}
