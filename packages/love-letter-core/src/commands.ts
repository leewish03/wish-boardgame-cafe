import { PlayerId, CardId, CardValue, MatchConfig } from './types';

export type GameCommand =
  | { type: 'FINALIZE_ACTION' }
  | { type: 'START_MATCH'; config?: Partial<MatchConfig> }
  | { type: 'START_ROUND' }
  | {
      type: 'PLAY_CARD';
      playerId: PlayerId;
      cardId: CardId;
      targetId?: PlayerId;
      guessValue?: CardValue;
      /** Server-only presentation boundary; stripped from client commands. */
      deferTransition?: boolean;
    }
  | { type: 'FORFEIT'; playerId: PlayerId }
  | { type: 'TIMEOUT_FORFEIT'; playerId: PlayerId }
  | { type: 'PLAYER_LEAVE'; playerId: PlayerId };
