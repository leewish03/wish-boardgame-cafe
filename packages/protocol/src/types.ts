import {
  GameState,
  PublicGameState,
  PrivatePlayerState,
  CardInstance,
  PlayerPublic,
} from '../../love-letter-core/src/index';
import { GameEventEnvelope } from './envelopes';

export type SessionErrorCode = 'ROOM_NOT_FOUND' | 'PLAYER_REMOVED' | 'SEAT_TAKEN_OVER'
  | 'SESSION_INVALID' | 'SESSION_NOT_BOUND' | 'SESSION_CONTEXT_MISMATCH';

export interface SessionFailure {
  success: false;
  code: SessionErrorCode;
  error: string;
  roomCode: string | null;
  userId: string | null;
  requestId?: string;
}

export interface RoomUnavailable {
  roomCode: string;
  userId: string | null;
  code: 'ROOM_NOT_FOUND' | 'PLAYER_REMOVED' | 'SEAT_TAKEN_OVER';
  error: string;
  requestId?: string;
}

export interface GameSnapshot {
  presentation?: {
    kind?: 'CARD_ACTION' | 'TURN_PREPARATION' | 'ROUND_RESULT';
    actionId: string;
    stateVersion: number;
    roundNumber?: number;
    activePlayerId?: string;
    actionIds?: string[];
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
