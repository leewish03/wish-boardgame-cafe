import {
  GameState,
  PublicGameState,
  PrivatePlayerState,
  CardInstance,
  PlayerPublic,
} from '../../love-letter-core/src/index';

export interface GameSnapshot {
  roomId: string;
  stateVersion: number;
  serverTime: number;
  publicState?: PublicGameState;
  privateState?: PrivatePlayerState;
  mySecretHand?: CardInstance[];
  game?: GameState | (Omit<GameState, 'secrets'> & { secrets?: undefined });
}

export interface RoomSnapshot {
  code: string;
  hostId: string;
  gameState: string;
  players: PlayerPublic[];
  isPaused: boolean;
  pausedPlayerId?: string | null;
  targetTokens: number;
  roundNumber?: number;
}
