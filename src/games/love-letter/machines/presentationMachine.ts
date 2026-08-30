import { createMachine } from 'xstate';

export const presentationMachine = createMachine({
  id: 'presentation',
  initial: 'IDLE',
  states: {
    IDLE: {
      on: {
        ENQUEUE_EVENT: 'CARD_PLAYING',
      },
    },
    CARD_PLAYING: {
      after: {
        350: 'TARGET_REVEAL',
      },
    },
    TARGET_REVEAL: {
      after: {
        300: 'EFFECT_IMPACT',
      },
    },
    EFFECT_IMPACT: {
      after: {
        350: 'RESULT_SUMMARY',
      },
    },
    RESULT_SUMMARY: {
      after: {
        400: 'DISCARDING',
      },
    },
    DISCARDING: {
      after: {
        250: 'SETTLING',
      },
    },
    SETTLING: {
      after: {
        200: 'IDLE',
      },
    },
  },
});
