import { createMachine } from 'xstate';

export const connectionMachine = createMachine({
  id: 'connection',
  initial: 'CONNECTED',
  states: {
    CONNECTED: {
      on: {
        DISCONNECT: 'TEMPORARILY_DISCONNECTED',
      },
    },
    TEMPORARILY_DISCONNECTED: {
      on: {
        SOCKET_RECONNECT_ATTEMPT: 'RECONNECTING',
        SOCKET_RECONNECTED: 'RESYNCING',
        TIMEOUT_EXPIRED: 'FAILED',
      },
    },
    RECONNECTING: {
      on: {
        SOCKET_CONNECTED: 'RESYNCING',
        RECONNECT_FAILED: 'FAILED',
      },
    },
    RESYNCING: {
      on: {
        SYNC_SUCCESS: 'CONNECTED',
        SYNC_FAILED: 'FAILED',
      },
    },
    FAILED: {
      on: {
        MANUAL_RETRY: 'RECONNECTING',
      },
    },
  },
});
