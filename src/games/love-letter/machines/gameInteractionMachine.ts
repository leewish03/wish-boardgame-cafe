import { createMachine } from 'xstate';

export const gameInteractionMachine = createMachine({
  id: 'gameInteraction',
  initial: 'IDLE',
  states: {
    IDLE: {
      on: {
        START_DRAG: 'DRAGGING',
        SELECT_CARD: 'CARD_SELECTED',
      },
    },
    DRAGGING: {
      on: {
        ENTER_DROP_ZONE: 'VALID_DROP',
        CANCEL_DRAG: 'IDLE',
      },
    },
    VALID_DROP: {
      on: {
        RELEASE_IN_DROP_ZONE: 'SUBMITTING',
        LEAVE_DROP_ZONE: 'DRAGGING',
        CANCEL_DRAG: 'IDLE',
      },
    },
    CARD_SELECTED: {
      on: {
        CANCEL_SELECTION: 'IDLE',
        SELECT_TARGET: 'TARGETING',
        SUBMIT_IMMEDIATE: 'SUBMITTING',
      },
    },
    TARGETING: {
      on: {
        CONFIRM_TARGET: 'SUBMITTING',
        OPEN_GUESS: 'GUESSING',
        CANCEL_TARGET: 'CARD_SELECTED',
      },
    },
    GUESSING: {
      on: {
        CONFIRM_GUESS: 'SUBMITTING',
        CANCEL_GUESS: 'TARGETING',
      },
    },
    SUBMITTING: {
      on: {
        SUBMIT_SUCCESS: 'RESOLVING',
        SUBMIT_FAILURE: 'IDLE',
      },
    },
    RESOLVING: {
      on: {
        RESOLVE_COMPLETE: 'SETTLING',
      },
    },
    SETTLING: {
      after: {
        400: 'IDLE',
      },
    },
  },
});
