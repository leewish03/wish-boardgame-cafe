import { legalActions } from './rules.js';

export function getPublicView(state) {
  return structuredClone({ gameType: state.gameType, matchState: state.matchState, playPhase: state.playPhase,
    roundNumber: state.roundNumber, stateVersion: state.stateVersion, players: state.players, config: state.config,
    outcome: state.outcome, jackPlayerId: state.jackPlayerId, police: state.police, pawnIndex: state.pawnIndex,
    revealed: state.revealed, moveCount: state.moveCount, specials: state.specials, clues: state.clues,
    searched: state.searched, history: state.history });
}

export function getPrivateView(state, playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return null;
  return structuredClone({ role: player.role, legal: legalActions(state, playerId),
    ...(player.role === 'JACK' ? { position: state.position, discoveries: state.discoveries, route: state.route, decisionSeed: state.seed } :
      { controlledPawnIds: state.police.filter(p => p.controllerId === playerId).map(p => p.id) }) });
}

export const getBotObservation = (state, playerId) => ({ public: getPublicView(state), private: getPrivateView(state, playerId) });
export const projectEvents = (events, playerId) => events.filter(e => !e.recipientId || e.recipientId === playerId).map(e => {
  const { recipientId, ...visible } = e;
  return structuredClone(visible);
});
