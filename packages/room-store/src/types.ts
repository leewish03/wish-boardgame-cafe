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

export interface Room<TGameState = GameState> {
  id: string; // room code
  code: string;
  hostId: string;
  gameState: 'LOBBY' | 'PLAYING' | 'ROUND_END' | 'GAME_OVER';
  stateVersion: number;
  players: RoomPlayer[];
  targetTokens: number;
  turnTimeLimit: number;
  gameType?: 'LOVE_LETTER' | 'DALMUTI';
  roundCount?: 5 | 10 | 20;
  maxPlayers?: 4 | 5 | 6 | 7 | 8;
  firstDealRevolution?: boolean;
  useStrippedDeck?: boolean;
  philanthropicScoring?: boolean;
  merchantExchange?: boolean;
  game?: TGameState;
  createdAt: number;
  updatedAt: number;
  isPaused: boolean;
  pausedPlayerId?: string;
  pauseExpiresAt?: number;
}

export interface RoomRepository<TGameState = GameState> {
  getRoom(id: string): Promise<Room<TGameState> | null>;
  saveRoom(room: Room<TGameState>): Promise<void>;
  deleteRoom(id: string): Promise<void>;
  listRooms?(): Promise<Room<TGameState>[]>;
}
