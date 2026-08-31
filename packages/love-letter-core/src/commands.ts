import { PlayerId, CardId, CardValue, MatchConfig } from './types';

export type GameCommand =
  | { type: 'START_MATCH'; config?: Partial<MatchConfig> }
  | { type: 'START_ROUND' }
  | {
      type: 'PLAY_CARD';
      playerId: PlayerId;
      cardId: CardId;
      targetId?: PlayerId;
      guessValue?: CardValue;
    }
  | { type: 'FORFEIT'; playerId: PlayerId }
  | { type: 'TIMEOUT_FORFEIT'; playerId: PlayerId }
  | { type: 'PLAYER_LEAVE'; playerId: PlayerId };
