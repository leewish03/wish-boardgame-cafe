import { createMachine } from 'xstate';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';

export interface PresentationContext {
  envelope: GameEventEnvelope | null;
  actorId?: string;
  targetId?: string;
  cardValue?: number;
  cardName?: string;
  guessValue?: number;
  resultType?: string;
}

export type PresentationPhase =
  | 'IDLE'
  | 'CARD_PLAYING'
  | 'TARGET_REVEAL'
  | 'EFFECT'
  | 'RESULT'
  | 'DISCARDING'
  | 'SETTLING';

export const presentationMachine = createMachine({
  id: 'presentation',
  initial: 'IDLE',
  types: {} as {
    context: PresentationContext;
    events:
      | { type: 'START'; envelope: GameEventEnvelope }
      | { type: 'ADVANCE' }
      | { type: 'FINISH' }
      | { type: 'RESET' };
  },
  context: {
    envelope: null,
  },
  states: {
    IDLE: {
      on: {
        START: 'CARD_PLAYING',
      },
    },
    CARD_PLAYING: {
      on: {
        ADVANCE: 'TARGET_REVEAL',
        FINISH: 'IDLE',
        RESET: 'IDLE',
      },
      after: {
        350: 'TARGET_REVEAL',
      },
    },
    TARGET_REVEAL: {
      on: {
        ADVANCE: 'EFFECT',
        FINISH: 'IDLE',
        RESET: 'IDLE',
      },
      after: {
        350: 'EFFECT',
      },
    },
    EFFECT: {
      on: {
        ADVANCE: 'RESULT',
        FINISH: 'IDLE',
        RESET: 'IDLE',
      },
      after: {
        600: 'RESULT',
      },
    },
    RESULT: {
      on: {
        ADVANCE: 'DISCARDING',
        FINISH: 'IDLE',
        RESET: 'IDLE',
      },
      after: {
        500: 'DISCARDING',
      },
    },
    DISCARDING: {
      on: {
        ADVANCE: 'SETTLING',
        FINISH: 'IDLE',
        RESET: 'IDLE',
      },
      after: {
        350: 'SETTLING',
      },
    },
    SETTLING: {
      on: {
        ADVANCE: 'IDLE',
        FINISH: 'IDLE',
        RESET: 'IDLE',
      },
      after: {
        250: 'IDLE',
      },
    },
  },
});

