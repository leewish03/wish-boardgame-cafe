export function getActivePlayers(state) {
  return state.players.filter((p) => !p.isEliminated);
}

export function isRoundOver(state) {
  const active = getActivePlayers(state);
  if (active.length <= 1) return true;
  if (state.deck.length === 0) return true;
  return false;
}

export function isMatchOver(state) {
  return state.players.some((p) => p.tokens >= state.config.targetTokens);
}

export function determineRoundWinners(state) {
  const active = getActivePlayers(state);
  if (active.length === 0) return [];
  if (active.length === 1) return [active[0]];

  // Compare highest card in hand
  let highestValue = -1;
  let candidates = [];

  for (const player of active) {
    const secret = state.secrets[player.id];
    const handCard = secret?.hand?.[0];
    const cardVal = handCard ? handCard.value : -1;

    if (cardVal > highestValue) {
      highestValue = cardVal;
      candidates = [player];
    } else if (cardVal === highestValue) {
      candidates.push(player);
    }
  }

  if (candidates.length <= 1) {
    return candidates;
  }

  // Tie breaker: highest total discard pile value
  let highestDiscardSum = -1;
  let tieWinners = [];

  for (const player of candidates) {
    const sum = (player.discardPile || []).reduce((acc, c) => acc + (c?.value || 0), 0);
    if (sum > highestDiscardSum) {
      highestDiscardSum = sum;
      tieWinners = [player];
    } else if (sum === highestDiscardSum) {
      tieWinners.push(player);
    }
  }

  return tieWinners;
}

export function calculateRemainingCards(playedDiscards, myHand) {
  const totalCounts = {
    1: 5,
    2: 2,
    3: 2,
    4: 2,
    5: 2,
    6: 1,
    7: 1,
    8: 1,
  };

  const currentVisible = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
  };

  for (const c of playedDiscards || []) {
    if (c?.value && currentVisible[c.value] !== undefined) {
      currentVisible[c.value]++;
    }
  }

  for (const c of myHand || []) {
    if (c?.value && currentVisible[c.value] !== undefined) {
      currentVisible[c.value]++;
    }
  }

  const result = {};
  for (let v = 1; v <= 8; v++) {
    result[v] = {
      total: totalCounts[v],
      remaining: Math.max(0, totalCounts[v] - currentVisible[v]),
    };
  }

  return result;
}
