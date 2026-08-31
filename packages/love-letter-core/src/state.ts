import {
  GameState,
  MatchConfig,
  PlayerPublic,
  PlayerSecret,
  PlayerId,
  PublicGameState,
  PrivatePlayerState,
} from './types';

export function createInitialGameState(
  initialPlayers: {
    id: PlayerId;
    nickname: string;
    avatar?: string;
    isHost?: boolean;
    isBot?: boolean;
    tokens?: number;
    personality?: string;
    memory?: Record<string, any>;
  }[],
  configOverrides?: Partial<MatchConfig>
): GameState {
  const config: MatchConfig = {
    targetTokens: initialPlayers.length === 2 ? 4 : initialPlayers.length === 3 ? 3 : 2,
    turnTimeoutSeconds: 30,
    maxPlayers: 6,
    minPlayers: 2,
    ...configOverrides,
  };

  const players: PlayerPublic[] = initialPlayers.map((p, idx) => ({
    id: p.id,
    nickname: p.nickname,
    avatar: p.avatar || '👑',
    tokens: p.tokens || 0,
    isReady: true,
    isHost: p.isHost !== undefined ? p.isHost : idx === 0,
    isBot: !!p.isBot,
    isEliminated: false,
    isProtected: false,
    cardCount: 0,
    discardPile: [],
    personality: p.personality,
    memory: p.memory,
  }));

  const secrets: Record<PlayerId, PlayerSecret> = {};
  for (const p of players) {
    secrets[p.id] = { id: p.id, hand: [] };
  }

  return {
    matchState: 'LOBBY',
    playPhase: 'ROUND_START',
    roundNumber: 0,
    config,
    players,
    secrets,
    deck: [],
    setAsideCard: null,
    setAsideOpenCards: [],
    currentTurnPlayerId: null,
    turnStartedAt: 0,
    turnExpiresAt: 0,
    lastAction: null,
    stateVersion: 1,
    matchWinnerId: null,
    roundWinnerIds: [],
  };
}

export function getPublicGameState(state: GameState): PublicGameState {
  return {
    matchState: state.matchState,
    playPhase: state.playPhase,
    roundNumber: state.roundNumber,
    config: state.config,
    players: state.players.map(p => ({
      ...p,
      hand: undefined,
    })),
    deckCount: state.deck.length,
    setAsideCardCount: state.setAsideCard ? 1 : 0,
    currentTurnPlayerId: state.currentTurnPlayerId,
    turnStartedAt: state.turnStartedAt,
    turnExpiresAt: state.turnExpiresAt,
    lastAction: state.lastAction,
    stateVersion: state.stateVersion,
    matchWinnerId: state.matchWinnerId,
    roundWinnerIds: state.roundWinnerIds,
    roundWinnerReason: state.roundWinnerReason,
  };
}

export function getPrivatePlayerState(
  state: GameState,
  playerId: PlayerId
): PrivatePlayerState {
  return state.secrets[playerId] || { id: playerId, hand: [] };
}
