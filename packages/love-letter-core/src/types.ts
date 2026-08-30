export type PlayerId = string;
export type CardId = string;

export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type CardName =
  | '경비병'
  | '사제'
  | '남작'
  | '하녀'
  | '왕자'
  | '국왕'
  | '백작부인'
  | '공주';

export interface CardMeta {
  value: CardValue;
  name: CardName;
  nameEn: string;
  count: number;
  description: string;
  detailedGuide: string;
  needsTarget: boolean;
  canTargetSelf: boolean;
  isGuessing: boolean;
}

export interface CardInstance {
  id: CardId;
  value: CardValue;
  name: CardName;
}

export interface PlayerPublic {
  id: PlayerId;
  nickname: string;
  avatar: string;
  tokens: number;
  isReady: boolean;
  isHost: boolean;
  isBot: boolean;
  isEliminated: boolean;
  isProtected: boolean;
  cardCount: number;
  discardPile: CardInstance[];
  eliminationReason?: string;
  eliminatedBy?: PlayerId;
}

export interface PlayerSecret {
  id: PlayerId;
  hand: CardInstance[];
}

export type MatchState = 'LOBBY' | 'PLAYING' | 'ROUND_END' | 'GAME_OVER';

export type PlayPhase =
  | 'ROUND_START'
  | 'TURN_START'
  | 'TURN_INPUT'
  | 'ACTION_RESOLVING'
  | 'TURN_TRANSITION';

export interface MatchConfig {
  targetTokens: number;
  turnTimeoutSeconds: number;
  maxPlayers: number;
  minPlayers: number;
}

export interface GameState {
  matchState: MatchState;
  playPhase: PlayPhase;
  roundNumber: number;
  config: MatchConfig;
  players: PlayerPublic[];
  secrets: Record<PlayerId, PlayerSecret>;
  deck: CardInstance[];
  setAsideCard: CardInstance | null;
  currentTurnPlayerId: PlayerId | null;
  turnStartedAt: number;
  turnExpiresAt: number;
  lastAction: GameEventSummary | null;
  stateVersion: number;
  matchWinnerId: PlayerId | null;
  roundWinnerIds: PlayerId[];
}

export interface GameEventSummary {
  actionId: string;
  actorId: PlayerId;
  card: CardInstance;
  targetId?: PlayerId;
  guessValue?: CardValue;
  resultType: string;
  description: string;
  revealedCard?: CardInstance;
  eliminatedPlayerId?: PlayerId;
  swapped?: boolean;
}
