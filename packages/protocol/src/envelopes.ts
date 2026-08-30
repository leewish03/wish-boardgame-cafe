import { GameEvent, GameState, PlayerId } from '../../love-letter-core/src/index';

export interface GameEventEnvelope {
  eventId: string;
  actionId: string;
  stateVersion: number;
  timestamp: number;
  event: GameEvent;
}

export interface GameSnapshot {
  roomId: string;
  stateVersion: number;
  serverTime: number;
  game: GameState;
  mySecretHand: any[];
}

export interface RoomSnapshot {
  code: string;
  hostId: string;
  gameState: string;
  players: any[];
  isPaused: boolean;
  pausedPlayerId?: string;
  targetTokens: number;
}
