import { Room, RoomRepository } from './types';

export class MemoryRoomRepository implements RoomRepository {
  private rooms: Map<string, Room> = new Map();

  async getRoom(id: string): Promise<Room | null> {
    const room = this.rooms.get(id);
    if (!room) return null;
    return JSON.parse(JSON.stringify(room));
  }

  async saveRoom(room: Room): Promise<void> {
    const cloned = JSON.parse(JSON.stringify(room));
    cloned.updatedAt = Date.now();
    this.rooms.set(room.id, cloned);
  }

  async deleteRoom(id: string): Promise<void> {
    this.rooms.delete(id);
  }

  async listRooms(): Promise<Room[]> {
    return Array.from(this.rooms.values()).map((r) => JSON.parse(JSON.stringify(r)));
  }

  clear(): void {
    this.rooms.clear();
  }
}
