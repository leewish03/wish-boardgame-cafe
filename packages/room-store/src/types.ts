import { GameState } from '../../love-letter-core/src/index';

export interface RoomPlayer {
  id: string;
  socketId?: string;
  nickname: string;
  avatarUrl: string;
  isReady: boolean;
  isHost: boolean;
  isBot?: boolean;
  botPersonality?: 'AGGRESSIVE' | 'DEFENSIVE' | 'CALCULATING';
  connected: boolean;
  disconnectedAt?: number;
  tokens: number;
}

export interface Room {
  id: string; // room code
  code: string;
  hostId: string;
  gameState: 'LOBBY' | 'PLAYING' | 'ROUND_END' | 'GAME_OVER';
  stateVersion: number;
  players: RoomPlayer[];
  targetTokens: number;
  turnTimeLimit: number;
  game?: GameState;
  createdAt: number;
  updatedAt: number;
  isPaused: boolean;
  pausedPlayerId?: string;
  pauseExpiresAt?: number;
}

export interface RoomRepository {
  getRoom(id: string): Promise<Room | null>;
  saveRoom(room: Room): Promise<void>;
  deleteRoom(id: string): Promise<void>;
  listRooms?(): Promise<Room[]>;
}
