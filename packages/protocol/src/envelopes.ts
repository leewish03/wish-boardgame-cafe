import { GameEvent, GameCommand, GameEventSummary, PlayerId } from '../../love-letter-core/src/index';

export interface GameEventEnvelope {
  eventId: string;
  actionId: string;
  stateVersion: number;
  /** Presentation boundary. Older clients may omit this field. */
  roundNumber?: number;
  timestamp: number;
  event: GameEvent;
  presentation?: GameEventSummary | null;
  recipientPlayerId?: PlayerId;
}

export interface GameCommandEnvelope {
  commandId: string;
  roomId: string;
  playerId: string;
  timestamp: number;
  command: GameCommand;
}
