export class TurnCoordinator {
  constructor(io, service) {
    this.io = io;
    this.service = service;
    this.turnTimers = new Map();
  }

  startTurnTimer(roomCode, turnExpiresAt, onTimeout) {
    this.clearTurnTimer(roomCode);
    const delay = Math.max(1000, turnExpiresAt - Date.now());
    const timer = setTimeout(() => {
      this.turnTimers.delete(roomCode);
      if (onTimeout) onTimeout();
    }, delay);
    timer.unref?.();
    this.turnTimers.set(roomCode, timer);
  }

  clearTurnTimer(roomCode) {
    if (this.turnTimers.has(roomCode)) {
      clearTimeout(this.turnTimers.get(roomCode));
      this.turnTimers.delete(roomCode);
    }
  }
}
