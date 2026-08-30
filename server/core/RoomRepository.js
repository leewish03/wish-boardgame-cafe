export class MemoryRoomRepository {
  constructor() {
    this.rooms = new Map();
  }

  async getRoom(id) {
    return this.rooms.get(id) || null;
  }

  async saveRoom(room) {
    this.rooms.set(room.code, room);
  }

  async deleteRoom(id) {
    this.rooms.delete(id);
  }

  async listRooms() {
    return Array.from(this.rooms.values());
  }
}

export const roomRepository = new MemoryRoomRepository();
