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

export const roomRepository = new MemoryRoomRepository();
