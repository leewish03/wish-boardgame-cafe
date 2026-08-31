import { GameState, PlayerId, PlayerPublic, CardValue, CardInstance } from './types';
import { CARD_DEFINITIONS } from './cards';

export function getActivePlayers(state: GameState): PlayerPublic[] {
  return state.players.filter(p => !p.isEliminated);
}

export function getValidTargets(
  state: GameState,
  playerId: PlayerId,
  cardValue: CardValue
): PlayerId[] {
  const meta = CARD_DEFINITIONS[cardValue];
  if (!meta || !meta.needsTarget) {
    return [];
  }

  if (meta.canTargetSelf) {
    // Prince (5): self + unprotected active opponents
    return state.players
      .filter(p => !p.isEliminated && (!p.isProtected || p.id === playerId))
      .map(p => p.id);
  }

  // Guard (1), Priest (2), Baron (3), King (6)
  return state.players
    .filter(p => p.id !== playerId && !p.isEliminated && !p.isProtected)
    .map(p => p.id);
}

export function getPlayableCards(state: GameState, playerId: PlayerId): CardInstance[] {
  const secret = state.secrets[playerId];
  if (!secret || secret.hand.length === 0) return [];

  const hasCountess = secret.hand.some(c => c.value === 7);
  const hasPrinceOrKing = secret.hand.some(c => c.value === 5 || c.value === 6);

  if (hasCountess && hasPrinceOrKing) {
    return secret.hand.filter(c => c.value === 7);
  }

  return secret.hand;
}

export function isRoundOver(state: GameState): boolean {
  const active = getActivePlayers(state);
  if (active.length <= 1) return true;
  if (state.deck.length === 0) return true;
  return false;
}

export function isMatchOver(state: GameState): boolean {
  return state.players.some(p => p.tokens >= state.config.targetTokens);
}

export function determineRoundWinners(state: GameState): PlayerPublic[] {
  const active = getActivePlayers(state);
  if (active.length === 0) return [];
  if (active.length === 1) return [active[0]];

  // Compare highest card in hand
  let highestValue = -1;
  let candidates: PlayerPublic[] = [];

  for (const player of active) {
    const secret = state.secrets[player.id];
    const handCard = secret?.hand[0];
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
  let tieWinners: PlayerPublic[] = [];

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

export function calculateRemainingCards(
  playedDiscards: { value: number }[],
  myHand: { value: number }[]
): Record<number, { remaining: number; total: number }> {
  const totalCounts: Record<number, number> = {
    1: 5,
    2: 2,
    3: 2,
    4: 2,
    5: 2,
    6: 1,
    7: 1,
    8: 1,
  };

  const currentVisible: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
  };

  for (const c of playedDiscards) {
    if (currentVisible[c.value] !== undefined) {
      currentVisible[c.value]++;
    }
  }

  for (const c of myHand) {
    if (currentVisible[c.value] !== undefined) {
      currentVisible[c.value]++;
    }
  }

  const result: Record<number, { remaining: number; total: number }> = {};
  for (let v = 1; v <= 8; v++) {
    result[v] = {
      total: totalCounts[v],
      remaining: Math.max(0, totalCounts[v] - currentVisible[v]),
    };
  }

  return result;
}
