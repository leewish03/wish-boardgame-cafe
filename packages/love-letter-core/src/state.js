export function createInitialGameState(
  initialPlayers,
  configOverrides
) {
  const config = {
    targetTokens: initialPlayers.length === 2 ? 4 : initialPlayers.length === 3 ? 3 : 2,
    turnTimeoutSeconds: 30,
    maxPlayers: 6,
    minPlayers: 2,
    ...configOverrides,
  };

  const players = initialPlayers.map((p) => ({
    id: p.id,
    nickname: p.nickname || p.name || '플레이어',
    avatar: p.avatar || p.avatarUrl || '👑',
    avatarUrl: p.avatarUrl || p.avatar || '👑',
    tokens: 0,
    isReady: true,
    isHost: !!p.isHost,
    isBot: !!p.isBot,
    isEliminated: false,
    isProtected: false,
    cardCount: 0,
    discardPile: [],
  }));

  const secrets = {};
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
    currentTurnPlayerId: null,
    turnStartedAt: 0,
    turnExpiresAt: 0,
    lastAction: null,
    stateVersion: 1,
    matchWinnerId: null,
    roundWinnerIds: [],
  };
}
