export const SOCKET_EVENTS = {
  // Client -> Server
  GAME_COMMAND: 'game:command',
  ROOM_COMMAND: 'room:command',
  SYNC_REQUEST: 'game:sync-request',

  // Server -> Client
  GAME_EVENT: 'game:event',
  GAME_SNAPSHOT: 'game:snapshot',
  ROOM_EVENT: 'room:event',
  ROOM_SNAPSHOT: 'room:snapshot',
  ERROR: 'game:error',
} as const;

export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
