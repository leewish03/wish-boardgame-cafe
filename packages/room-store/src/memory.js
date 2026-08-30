export class MemoryRoomRepository {
  constructor() {
    this.rooms = new Map();
  }

  async getRoom(id) {
    const room = this.rooms.get(id);
    if (!room) return null;
    return JSON.parse(JSON.stringify(room));
  }

  async saveRoom(room) {
    const cloned = JSON.parse(JSON.stringify(room));
    cloned.updatedAt = Date.now();
    this.rooms.set(room.id, cloned);
  }

  async deleteRoom(id) {
    this.rooms.delete(id);
  }

  async listRooms() {
    return Array.from(this.rooms.values()).map((r) => JSON.parse(JSON.stringify(r)));
  }

  clear() {
    this.rooms.clear();
  }
}
