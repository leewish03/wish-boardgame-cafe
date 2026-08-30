import { PlayerId, CardInstance, CardValue } from './types';

export type GameEvent =
  | { type: 'ROUND_STARTED'; roundNumber: number; firstPlayerId: PlayerId; remainingDeckCount: number }
  | { type: 'CARD_DRAWN'; playerId: PlayerId; card: CardInstance; remainingDeckCount: number }
  | { type: 'CARD_PLAYED'; actionId: string; actorId: PlayerId; card: CardInstance }
  | { type: 'PLAYER_TARGETED'; actionId: string; actorId: PlayerId; targetId: PlayerId }
  | { type: 'CARD_GUESSED'; actionId: string; actorId: PlayerId; targetId: PlayerId; guessValue: CardValue }
  | { type: 'GUARD_SUCCEEDED'; actionId: string; actorId: PlayerId; targetId: PlayerId; guessedCard: CardInstance }
  | { type: 'GUARD_FAILED'; actionId: string; actorId: PlayerId; targetId: PlayerId; guessValue: CardValue }
  | { type: 'PRIEST_REVEALED'; actionId: string; actorId: PlayerId; targetId: PlayerId; revealedCard: CardInstance }
  | { type: 'BARON_COMPARED'; actionId: string; actorId: PlayerId; targetId: PlayerId; winnerId?: PlayerId; eliminatedId?: PlayerId }
  | { type: 'HANDMAID_PROTECTED'; actionId: string; actorId: PlayerId }
  | { type: 'PRINCE_DISCARDED'; actionId: string; actorId: PlayerId; targetId: PlayerId; discardedCard: CardInstance }
  | { type: 'HANDS_SWAPPED'; actionId: string; actorId: PlayerId; targetId: PlayerId }
  | { type: 'PLAYER_ELIMINATED'; playerId: PlayerId; reason: string; eliminatedBy?: PlayerId }
  | { type: 'CARD_DISCARDED'; playerId: PlayerId; card: CardInstance }
  | { type: 'TURN_ENDED'; previousPlayerId: PlayerId; nextPlayerId: PlayerId; turnExpiresAt: number }
  | { type: 'ROUND_ENDED'; winnerIds: PlayerId[]; winnerCards: Record<PlayerId, CardInstance>; scores: Record<PlayerId, number> }
  | { type: 'MATCH_ENDED'; matchWinnerId: PlayerId; finalScores: Record<PlayerId, number> };
