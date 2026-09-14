import { GameEvent, GameCommand, GameEventSummary, PlayerId } from '../../love-letter-core/src/index';

export interface GameEventEnvelope<TEvent = GameEvent, TPresentation = GameEventSummary> {
  eventId: string;
  actionId: string;
  stateVersion: number;
  /** Presentation boundary. Older clients may omit this field. */
  roundNumber?: number;
  timestamp: number;
  event: TEvent;
  presentation?: TPresentation | null;
  /** Groups several physical actions into one server-gated turn preparation. */
  presentationBatch?: {
    id: string;
    kind: 'TURN_PREPARATION' | 'ROUND_RESULT';
    isFinalAction: boolean;
  };
  recipientPlayerId?: PlayerId;
}

export interface GameCommandEnvelope<TCommand = GameCommand> {
  commandId: string;
  roomId: string;
  playerId: string;
  timestamp: number;
  command: TCommand;
}
