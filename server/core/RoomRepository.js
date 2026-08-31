import { SupabaseRoomRepository } from './SupabaseRoomRepository.js';

export class MemoryRoomRepository {
  constructor() {
    this._rooms = new Map();
  }

  async getRoom(id) {
    if (!id) return null;
    const code = String(id).toUpperCase().trim();
    return this._rooms.get(code) || null;
  }

  async saveRoom(room) {
    if (!room || !room.code) return;
    const code = String(room.code).toUpperCase().trim();
    room.updatedAt = Date.now();
    this._rooms.set(code, room);
  }

  async deleteRoom(id) {
    if (!id) return;
    const code = String(id).toUpperCase().trim();
    this._rooms.delete(code);
  }

  async listRooms() {
    return Array.from(this._rooms.values());
  }

  clear() {
    this._rooms.clear();
  }
}

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

export const roomRepository = connectionString
  ? new SupabaseRoomRepository(connectionString)
  : new MemoryRoomRepository();

export async function initializeRoomRepository() {
  if (typeof roomRepository.initialize === 'function') {
    await roomRepository.initialize();
  }
}
