import {
  GameState,
  PublicGameState,
  PrivatePlayerState,
  CardInstance,
  PlayerPublic,
} from '../../love-letter-core/src/index';
import { GameEventEnvelope } from './envelopes';

export interface GameSnapshot {
  presentation?: {
    actionId: string;
    stateVersion: number;
    returnRequested: boolean;
    before: { publicState: PublicGameState; privateState: PrivatePlayerState };
    events: GameEventEnvelope[];
  } | null;
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
