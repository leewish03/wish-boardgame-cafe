import { setup, assign } from 'xstate';
import { CardValue, PlayerId, CardInstance } from '../../../../packages/love-letter-core/src/types';

export interface GameInteractionContext {
  selectedCard: CardInstance | null;
  selectedTargetId: PlayerId | null;
  guessValue: CardValue | null;
  isOverDropZone: boolean;
  errorMessage: string | null;
}

export type GameInteractionEvent =
  | { type: 'START_DRAG'; card: CardInstance }
  | { type: 'DRAG_MOVE'; isOverDropZone: boolean }
  | { type: 'ENTER_DROP_ZONE' }
  | { type: 'LEAVE_DROP_ZONE' }
  | { type: 'CANCEL_DRAG' }
  | { type: 'DROP_CARD'; card: CardInstance; needsTarget: boolean; isGuard: boolean }
  | { type: 'SELECT_CARD'; card: CardInstance; needsTarget: boolean; isGuard: boolean }
  | { type: 'CANCEL_SELECTION' }
  | { type: 'SELECT_TARGET'; targetId: PlayerId; isGuard: boolean }
  | { type: 'CANCEL_TARGET' }
  | { type: 'SELECT_GUESS'; guessValue: CardValue }
  | { type: 'CANCEL_GUESS' }
  | { type: 'SUBMIT_IMMEDIATE' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_FAILURE'; error?: string }
  | { type: 'RESOLVE_COMPLETE' }
  | { type: 'DISABLE' }
  | { type: 'ENABLE' }
  | { type: 'RESET' };

export const gameInteractionMachine = setup({
  types: {
    context: {} as GameInteractionContext,
    events: {} as GameInteractionEvent,
  },
  actions: {
    setDragCard: assign({
      selectedCard: ({ event }) => ('card' in event ? event.card : null),
      isOverDropZone: false,
      errorMessage: null,
    }),
    setOverDropZone: assign({
      isOverDropZone: ({ event }) => (event.type === 'DRAG_MOVE' ? event.isOverDropZone : true),
    }),
    clearOverDropZone: assign({
      isOverDropZone: false,
    }),
    setTarget: assign({
      selectedTargetId: ({ event }) => ('targetId' in event ? event.targetId : null),
    }),
    setGuess: assign({
      guessValue: ({ event }) => ('guessValue' in event ? event.guessValue : null),
    }),
    setError: assign({
      errorMessage: ({ event }) => (event.type === 'SUBMIT_FAILURE' ? event.error || '카드를 제출할 수 없습니다.' : null),
    }),
    clearAll: assign({
      selectedCard: null,
      selectedTargetId: null,
      guessValue: null,
      isOverDropZone: false,
      errorMessage: null,
    }),
    clearTargetAndGuess: assign({
      selectedTargetId: null,
      guessValue: null,
    }),
  },
  guards: {
    needsTargetOnDrop: ({ event }) => event.type === 'DROP_CARD' && event.needsTarget,
    needsTargetOnSelect: ({ event }) => event.type === 'SELECT_CARD' && event.needsTarget,
    isGuardTarget: ({ event }) => event.type === 'SELECT_TARGET' && event.isGuard,
  },
}).createMachine({
  id: 'gameInteraction',
  initial: 'IDLE',
  context: {
    selectedCard: null,
    selectedTargetId: null,
    guessValue: null,
    isOverDropZone: false,
    errorMessage: null,
  },
  states: {
    IDLE: {
      on: {
        START_DRAG: {
          target: 'DRAGGING',
          actions: ['setDragCard'],
        },
        SELECT_CARD: [
          {
            guard: 'needsTargetOnSelect',
            target: 'TARGETING',
            actions: ['setDragCard'],
          },
          {
            target: 'SUBMITTING',
            actions: ['setDragCard'],
          },
        ],
        DISABLE: 'DISABLED',
        RESET: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
      },
    },
    DISABLED: {
      on: {
        ENABLE: 'IDLE',
        RESET: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
      },
    },
    DRAGGING: {
      on: {
        ENTER_DROP_ZONE: {
          target: 'VALID_DROP',
          actions: ['setOverDropZone'],
        },
        DRAG_MOVE: {
          actions: ['setOverDropZone'],
        },
        CANCEL_DRAG: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
        DISABLE: 'DISABLED',
        RESET: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
      },
    },
    VALID_DROP: {
      on: {
        LEAVE_DROP_ZONE: {
          target: 'DRAGGING',
          actions: ['clearOverDropZone'],
        },
        DROP_CARD: [
          {
            guard: 'needsTargetOnDrop',
            target: 'TARGETING',
            actions: ['clearOverDropZone'],
          },
          {
            target: 'SUBMITTING',
            actions: ['clearOverDropZone'],
          },
        ],
        CANCEL_DRAG: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
        DISABLE: 'DISABLED',
        RESET: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
      },
    },
    TARGETING: {
      on: {
        SELECT_TARGET: [
          {
            guard: 'isGuardTarget',
            target: 'GUESSING',
            actions: ['setTarget'],
          },
          {
            target: 'SUBMITTING',
            actions: ['setTarget'],
          },
        ],
        SUBMIT_IMMEDIATE: {
          target: 'SUBMITTING',
        },
        CANCEL_TARGET: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
        CANCEL_SELECTION: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
        RESET: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
        DISABLE: 'DISABLED',
      },
    },
    GUESSING: {
      on: {
        SELECT_GUESS: {
          target: 'SUBMITTING',
          actions: ['setGuess'],
        },
        CANCEL_GUESS: {
          target: 'TARGETING',
          actions: ['clearTargetAndGuess'],
        },
        RESET: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
        DISABLE: 'DISABLED',
      },
    },
    SUBMITTING: {
      on: {
        SUBMIT_SUCCESS: 'RESOLVING',
        SUBMIT_FAILURE: {
          target: 'IDLE',
          actions: ['setError'],
        },
        RESET: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
        DISABLE: 'DISABLED',
      },
    },
    RESOLVING: {
      on: {
        RESOLVE_COMPLETE: 'SETTLING',
        RESET: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
        DISABLE: 'DISABLED',
      },
    },
    SETTLING: {
      after: {
        400: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
      },
      on: {
        RESET: {
          target: 'IDLE',
          actions: ['clearAll'],
        },
        DISABLE: 'DISABLED',
      },
    },
  },
});
