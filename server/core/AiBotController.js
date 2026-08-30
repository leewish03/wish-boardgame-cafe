const BOT_NAMES = [
  { name: '알렉산더 남작', avatar: '🎩', personality: 'AGGRESSIVE' },
  { name: '마리안느 시녀', avatar: '🪞', personality: 'DEFENSIVE' },
  { name: '줄리앙 기사', avatar: '⚔️', personality: 'CALCULATING' },
  { name: '엘레나 백작부인', avatar: '🌹', personality: 'BLUFFING' },
];

export function createBotPlayer(existingPlayers = []) {
  const existingNames = new Set(existingPlayers.map(p => p.nickname));
  const available = BOT_NAMES.filter(b => !existingNames.has(`${b.name} (AI)`));
  const chosen = available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];

  return {
    id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nickname: `${chosen.name} (AI)`,
    avatar: chosen.avatar,
    tokens: 0,
    isReady: true,
    isHost: false,
    isBot: true,
    isEliminated: false,
    isProtected: false,
    personality: chosen.personality,
    memory: {
      knownPlayerCards: {},
    },
    discardPile: [],
    cardCount: 0,
  };
}

export function decideBotAction(gameState, botPlayer) {
  const secret = gameState.secrets[botPlayer.id];
  const hand = secret ? secret.hand : [];
  if (hand.length === 0) return null;

  // Countess rule check
  const hasCountess = hand.some(c => c.value === 7);
  const hasPrinceOrKing = hand.some(c => c.value === 5 || c.value === 6);
  if (hasCountess && hasPrinceOrKing) {
    const countess = hand.find(c => c.value === 7);
    return { cardId: countess.id };
  }

  // Active opponents
  const validOpponents = gameState.players.filter(
    p => p.id !== botPlayer.id && !p.isEliminated && !p.isProtected
  );

  // If holding Guard(1) and know an opponent's card
  const guard = hand.find(c => c.value === 1);
  if (guard && validOpponents.length > 0 && botPlayer.memory && botPlayer.memory.knownPlayerCards) {
    for (const opp of validOpponents) {
      const known = botPlayer.memory.knownPlayerCards[opp.id];
      if (known && known.cardValue && known.cardValue !== 1) {
        return {
          cardId: guard.id,
          targetId: opp.id,
          guessValue: known.cardValue,
        };
      }
    }
  }

  // Pick playable card
  const sortedHand = [...hand].sort((a, b) => {
    if (a.value === 8) return 1;
    if (b.value === 8) return -1;
    return a.value - b.value;
  });

  const chosenCard = sortedHand[0];
  const meta = chosenCard.value;

  if (meta === 4 || meta === 7 || meta === 8) {
    return { cardId: chosenCard.id };
  }

  if (validOpponents.length === 0) {
    if (meta === 5) {
      return { cardId: chosenCard.id, targetId: botPlayer.id };
    }
    return { cardId: chosenCard.id };
  }

  const target = validOpponents[Math.floor(Math.random() * validOpponents.length)];

  if (meta === 1) {
    const guessPool = [2, 3, 4, 5, 6, 7, 8];
    const guessValue = guessPool[Math.floor(Math.random() * guessPool.length)];
    return {
      cardId: chosenCard.id,
      targetId: target.id,
      guessValue,
    };
  }

  return {
    cardId: chosenCard.id,
    targetId: target.id,
  };
}
