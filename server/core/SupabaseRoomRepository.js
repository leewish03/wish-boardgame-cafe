import pg from 'pg';

const RUNTIME_ROOM_FIELDS = new Set([
  'turnTimer',
  'pauseTimeout',
  'roundAutoAdvanceTimer',
  'botTimer',
]);

function clonePersistable(value, key = '') {
  if (value === null || typeof value !== 'object') return value;
  if (RUNTIME_ROOM_FIELDS.has(key) || key === 'socketId') return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => clonePersistable(item))
      .filter((item) => item !== undefined);
  }

  const result = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    const cloned = clonePersistable(childValue, childKey);
    if (cloned !== undefined) result[childKey] = cloned;
  }
  return result;
}

function restoreRoom(state) {
  if (!state || typeof state !== 'object') return null;
  const room = clonePersistable(state);
  for (const player of room.players || []) {
    player.socketId = null;
    player.isDisconnected = true;
  }
  room.isPaused = room.gameState === 'PLAYING' || room.gameState === 'ROUND_END';
  room.pausedPlayerId = room.isPaused ? room.pausedPlayerId || null : null;
  room.pauseExpiresAt = null;
  return room;
}

export class SupabaseRoomRepository {
  constructor(connectionString) {
    this._rooms = new Map();
    this.pool = new pg.Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 20_000,
    });
  }

  async initialize() {
    const { rows } = await this.pool.query(
      'select room_code, state from wish_private.rooms order by updated_at asc'
    );
    for (const row of rows) {
      const room = restoreRoom(row.state);
      if (room?.code) this._rooms.set(String(room.code).toUpperCase(), room);
    }
  }

  async getRoom(id) {
    if (!id) return null;
    return this._rooms.get(String(id).toUpperCase().trim()) || null;
  }

  async saveRoom(room) {
    if (!room?.code) return;
    const code = String(room.code).toUpperCase().trim();
    room.updatedAt = Date.now();
    this._rooms.set(code, room);

    const state = clonePersistable(room);
    await this.pool.query(
      `insert into wish_private.rooms (room_code, state, state_version, created_at, updated_at)
       values ($1, $2::jsonb, $3, to_timestamp($4 / 1000.0), now())
       on conflict (room_code) do update
       set state = excluded.state,
           state_version = excluded.state_version,
           updated_at = now()`,
      [code, JSON.stringify(state), room.stateVersion || 1, room.createdAt || Date.now()]
    );
  }

  async deleteRoom(id) {
    if (!id) return;
    const code = String(id).toUpperCase().trim();
    this._rooms.delete(code);
    await this.pool.query('delete from wish_private.rooms where room_code = $1', [code]);
  }

  async listRooms() {
    return Array.from(this._rooms.values());
  }

  async close() {
    await this.pool.end();
  }
}

export { clonePersistable };
