import { PlayerId, CardInstance, CardValue } from './types';

export type GameEvent =
  | { type: 'ROUND_STARTED'; roundNumber: number; firstPlayerId: PlayerId; remainingDeckCount: number }
  | { type: 'TURN_STARTED'; playerId: PlayerId; turnExpiresAt: number; remainingDeckCount: number }
  | { type: 'CARD_DRAWN'; playerId: PlayerId; card: CardInstance; remainingDeckCount: number; actionId?: string; sequence?: number; drawSource?: 'DECK' | 'SET_ASIDE' }
  | { type: 'CARD_PLAYED'; actionId: string; actorId: PlayerId; card: CardInstance }
  | { type: 'PLAYER_TARGETED'; actionId: string; actorId: PlayerId; targetId: PlayerId }
  | { type: 'GUARD_GUESSED'; actionId: string; actorId: PlayerId; targetId: PlayerId; guessValue: CardValue }
  | { type: 'CARD_GUESSED'; actionId: string; actorId: PlayerId; targetId: PlayerId; guessValue: CardValue }
  | { type: 'GUARD_SUCCESS'; actionId: string; actorId: PlayerId; targetId: PlayerId; guessedCard: CardInstance }
  | { type: 'GUARD_SUCCEEDED'; actionId: string; actorId: PlayerId; targetId: PlayerId; guessedCard: CardInstance }
  | { type: 'GUARD_FAILED'; actionId: string; actorId: PlayerId; targetId: PlayerId; guessValue: CardValue }
  | { type: 'PRIEST_USED'; actionId: string; actorId: PlayerId; targetId: PlayerId; revealedCard: CardInstance }
  | { type: 'PRIEST_REVEALED'; actionId: string; actorId: PlayerId; targetId: PlayerId; revealedCard: CardInstance }
  | { type: 'BARON_DUEL_STARTED'; actionId: string; actorId: PlayerId; targetId: PlayerId; winnerId?: PlayerId; eliminatedId?: PlayerId; isTie?: boolean }
  | { type: 'BARON_COMPARED'; actionId: string; actorId: PlayerId; targetId: PlayerId; winnerId?: PlayerId; eliminatedId?: PlayerId; isTie?: boolean }
  | { type: 'PLAYER_PROTECTED'; actionId: string; actorId: PlayerId }
  | { type: 'HANDMAID_PROTECTED'; actionId: string; actorId: PlayerId }
  | { type: 'PRINCE_DISCARDED'; actionId: string; actorId: PlayerId; targetId: PlayerId; discardedCard: CardInstance }
  | { type: 'KING_SWAP'; actionId: string; actorId: PlayerId; targetId: PlayerId }
  | { type: 'HANDS_SWAPPED'; actionId: string; actorId: PlayerId; targetId: PlayerId }
  | { type: 'PLAYER_ELIMINATED'; playerId: PlayerId; reason: string; actionId?: string; sequence?: number; eliminatedBy?: PlayerId }
  | { type: 'CARD_DISCARDED'; playerId: PlayerId; card: CardInstance }
  | { type: 'TURN_ENDED'; previousPlayerId: PlayerId; nextPlayerId: PlayerId; turnExpiresAt: number }
  | { type: 'ROUND_ENDED'; winnerIds: PlayerId[]; winnerCards: Record<PlayerId, CardInstance>; scores: Record<PlayerId, number>; reason?: string }
  | { type: 'MATCH_ENDED'; matchWinnerId: PlayerId | null; finalScores: Record<PlayerId, number>; reason?: string };
