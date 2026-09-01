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

export type CardNameEn =
  | 'Guard'
  | 'Priest'
  | 'Baron'
  | 'Handmaid'
  | 'Prince'
  | 'King'
  | 'Countess'
  | 'Princess';

export interface CardMeta {
  value: CardValue;
  name: CardName;
  nameEn: CardNameEn;
  count: number;
  color: string;
  icon: string;
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
  nameEn?: string;
  color?: string;
  icon?: string;
  desc?: string;
  description?: string;
}

export interface PlayerPublic {
  id: PlayerId;
  nickname: string;
  avatar: string;
  avatarUrl?: string;
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
  personality?: string;
  memory?: Record<string, any>;
  hand?: CardInstance[];
}

export type Player = PlayerPublic;

export interface PlayerSecret {
  id: PlayerId;
  hand: CardInstance[];
}

export type PrivatePlayerState = PlayerSecret;

export type MatchState = 'LOBBY' | 'PLAYING' | 'ROUND_END' | 'GAME_OVER';

export type PlayPhase =
  | 'ROUND_START'
  | 'TURN_START'
  | 'TURN_INPUT'
  | 'ACTION_RESOLVING'
  | 'TURN_TRANSITION'
  | 'ROUND_END'
  | 'MATCH_END'
  | 'GAME_OVER';

export interface MatchConfig {
  targetTokens: number;
  turnTimeoutSeconds: number;
  maxPlayers: number;
  minPlayers: number;
}

export interface GameEventSummary {
  actionId: string;
  actorId: PlayerId;
  card: CardInstance;
  targetId?: PlayerId | null;
  guessValue?: CardValue | null;
  resultType: string;
  description: string;
  revealedCard?: CardInstance | null;
  eliminatedPlayerId?: PlayerId | null;
  swapped?: boolean;
}

export type OutcomeReason = 'LAST_SURVIVOR' | 'DECK_EXHAUSTED' | 'FORFEIT' | 'TIE_BREAK';

export interface GameOutcome {
  kind: 'ROUND' | 'MATCH';
  reason: OutcomeReason;
  winnerIds: PlayerId[];
  winnerCards: Record<PlayerId, CardInstance>;
  scores: Record<PlayerId, number>;
  previousScores?: Record<PlayerId, number>;
  nextStarterId?: PlayerId | null;
  advanceAt?: number | null;
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
  setAsideOpenCards?: CardInstance[];
  currentTurnPlayerId: PlayerId | null;
  turnStartedAt: number;
  turnExpiresAt: number;
  lastAction: GameEventSummary | null;
  stateVersion: number;
  matchWinnerId: PlayerId | null;
  roundWinnerIds: PlayerId[];
  roundWinnerReason?: string;
  outcome?: GameOutcome | null;
}

export type InternalGameState = GameState;

export interface PublicGameState {
  matchState: MatchState;
  playPhase: PlayPhase;
  roundNumber: number;
  config: MatchConfig;
  players: PlayerPublic[];
  deckCount: number;
  setAsideCardCount: number;
  currentTurnPlayerId: PlayerId | null;
  turnStartedAt: number;
  turnExpiresAt: number;
  lastAction: GameEventSummary | null;
  stateVersion: number;
  matchWinnerId: PlayerId | null;
  roundWinnerIds: PlayerId[];
  roundWinnerReason?: string;
  outcome?: GameOutcome | null;
}
