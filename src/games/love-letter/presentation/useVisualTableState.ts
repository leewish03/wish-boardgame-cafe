import { useCallback, useEffect, useRef, useState } from 'react';
import { CardInstance, GameState, PlayerPublic } from '../../../../packages/love-letter-core/src/types';

/**
 * A deliberately small presentation-only copy of the table. It starts from
 * the last settled server snapshot, then changes only after a visible event
 * finishes. Game rules and input validation always continue to use GameState.
 */
export interface VisualTableState {
  stateVersion: number;
  players: PlayerPublic[];
  myHand: CardInstance[];
  deckCount: number;
  setAsideCount: number;
}

function copyCard(card: CardInstance): CardInstance {
  return { ...card };
}

function fromSnapshot(gameState: GameState, myHand: CardInstance[]): VisualTableState {
  const raw = gameState as GameState & { deckCount?: number; setAsideCardCount?: number };
  return {
    stateVersion: gameState.stateVersion || 0,
    players: (gameState.players || []).map((player) => ({
      ...player,
      cardCount: player.cardCount || 0,
      discardPile: (player.discardPile || []).map(copyCard),
    })),
    myHand: (myHand || []).map(copyCard),
    deckCount: raw.deckCount ?? gameState.deck?.length ?? 0,
    setAsideCount: raw.setAsideCardCount ?? (gameState.setAsideCard ? 1 : 0),
  };
}

function updatePlayer(players: PlayerPublic[], playerId: string | undefined, update: (player: PlayerPublic) => PlayerPublic) {
  if (!playerId) return players;
  return players.map((player) => player.id === playerId ? update(player) : player);
}

function appendDiscard(player: PlayerPublic, card: CardInstance | undefined): PlayerPublic {
  if (!card || (player.discardPile || []).some((item) => item.id === card.id)) return player;
  return { ...player, discardPile: [...(player.discardPile || []), copyCard(card)] };
}

function applyEvent(table: VisualTableState, event: any, localUserId: string, latest: VisualTableState): VisualTableState {
  if (!event?.type) return table;
  const card = event.card || event.discardedCard || event.revealedCard || event.guessedCard;
  let next = table;

  switch (event.type) {
    case 'CARD_DRAWN': {
      const playerId = event.playerId;
      next = {
        ...next,
        deckCount: typeof event.remainingDeckCount === 'number' ? event.remainingDeckCount : Math.max(0, next.deckCount - 1),
        setAsideCount: event.drawSource === 'SET_ASIDE' ? Math.max(0, next.setAsideCount - 1) : next.setAsideCount,
        players: updatePlayer(next.players, playerId, (player) => ({ ...player, cardCount: player.cardCount + 1 })),
      };
      if (playerId === localUserId) {
        const drawn = event.card as CardInstance | undefined;
        next = { ...next, myHand: drawn ? [...next.myHand, copyCard(drawn)].slice(-2) : latest.myHand.map(copyCard) };
      }
      break;
    }
    case 'CARD_PLAYED': {
      const actorId = event.actorId;
      next = {
        ...next,
        players: updatePlayer(next.players, actorId, (player) => appendDiscard({ ...player, cardCount: Math.max(0, player.cardCount - 1) }, event.card)),
      };
      if (actorId === localUserId && event.card?.id) next = { ...next, myHand: next.myHand.filter((item) => item.id !== event.card.id) };
      break;
    }
    case 'PRINCE_DISCARDED': {
      next = {
        ...next,
        players: updatePlayer(next.players, event.targetId, (player) => appendDiscard({ ...player, cardCount: Math.max(0, player.cardCount - 1) }, event.discardedCard)),
      };
      if (event.targetId === localUserId && event.discardedCard?.id) next = { ...next, myHand: next.myHand.filter((item) => item.id !== event.discardedCard.id) };
      break;
    }
    case 'PLAYER_PROTECTED':
    case 'HANDMAID_PROTECTED':
      next = { ...next, players: updatePlayer(next.players, event.actorId || event.playerId, (player) => ({ ...player, isProtected: true })) };
      break;
    case 'PLAYER_ELIMINATED':
      next = { ...next, players: updatePlayer(next.players, event.playerId || event.eliminatedId, (player) => ({ ...player, isEliminated: true, cardCount: 0 })) };
      if ((event.playerId || event.eliminatedId) === localUserId) next = { ...next, myHand: [] };
      break;
    case 'HANDS_SWAPPED':
    case 'KING_SWAP':
      if (event.actorId === localUserId || event.targetId === localUserId) next = { ...next, myHand: latest.myHand.map(copyCard) };
      break;
    default:
      break;
  }
  return next;
}

export function useVisualTableState(gameState: GameState, myHand: CardInstance[], localUserId: string, isActionPlaying: boolean) {
  const latestRef = useRef<VisualTableState>(fromSnapshot(gameState, myHand));
  const [visualTable, setVisualTable] = useState<VisualTableState>(() => latestRef.current);

  useEffect(() => {
    const latest = fromSnapshot(gameState, myHand);
    latestRef.current = latest;
    if (!isActionPlaying) setVisualTable(latest);
  }, [gameState, myHand, isActionPlaying]);

  const applyCompletedEvent = useCallback((event: any) => {
    setVisualTable((previous) => applyEvent(previous, event, localUserId, latestRef.current));
  }, [localUserId]);

  const settleToSnapshot = useCallback(() => {
    setVisualTable(latestRef.current);
  }, []);

  return { visualTable, applyCompletedEvent, settleToSnapshot };
}
