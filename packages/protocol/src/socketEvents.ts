export const SOCKET_EVENTS = {
  // Room Management
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_READY: 'room:ready',
  ROOM_START: 'room:start',
  ROOM_COMMAND: 'room:command',
  ROOM_EVENT: 'room:event',
  ROOM_SNAPSHOT: 'room:snapshot',

  // Game Engine Protocol
  GAME_COMMAND: 'game:command',
  GAME_ADVANCE: 'game:advance',
  GAME_EVENT: 'game:event',
  GAME_SNAPSHOT: 'game:snapshot',
  SYNC_REQUEST: 'game:sync-request',
  PRIEST_RESULT: 'game:priest-result',
  ACTION_RESULT: 'game:action-result',
  ACTION_SHOWCASE: 'game:action-showcase',
  ERROR: 'game:error',

  // WebRTC & Audio / STT
  WEBRTC_SIGNAL: 'webrtc:signal',
  STT_BROADCAST: 'stt:broadcast',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
