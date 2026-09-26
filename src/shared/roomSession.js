export function normalizeSavedSession(data) {
  return data ? { ...data, userId: data.userId || data.id || null } : null;
}

export function createRoomSessionBoundary() {
  let generation = 0;
  let context = null;
  let pending = null;
  let buffered = null;
  return {
    invalidate() { generation += 1; context = null; pending = null; buffered = null; },
    begin(roomCode, userId) {
      generation += 1;
      context = null;
      buffered = null;
      pending = { generation, roomCode, userId, requestId: `session_${generation}` };
      return pending;
    },
    isCurrent(request) { return pending === request && request.generation === generation; },
    accept(request, roomCode, userId) {
      if (!this.isCurrent(request)) return false;
      context = { generation, roomCode, userId, requestId: request.requestId };
      pending = null;
      return true;
    },
    matches(target) {
      const current = context || pending;
      return !!current && !!target?.roomCode && target.roomCode === current.roomCode
        && (!target.userId || target.userId === current.userId)
        && (!target.requestId || target.requestId === current.requestId);
    },
    snapshot() { return context || pending; },
    version() { return generation; },
    allows(state) {
      return !!context && state?.code === context.roomCode
        && state.players?.some(p => p.id === context.userId);
    },
    buffer(state) { if (pending && (!pending.roomCode || state?.code === pending.roomCode)) buffered = state; },
    takeBuffered() { const state = buffered; buffered = null; return this.allows(state) ? state : null; },
  };
}

export function terminalSessionCode(result) {
  if (result?.code) return ['ROOM_NOT_FOUND', 'PLAYER_REMOVED', 'SEAT_TAKEN_OVER', 'SESSION_INVALID'].includes(result.code) ? result.code : null;
  const message = String(result?.error || '');
  if (/방\s*(?:을|이)?\s*(?:찾을 수 없|존재하지)|방 없음/.test(message)) return 'ROOM_NOT_FOUND';
  if (/플레이어 없음|등록된 플레이어가 아닙니다/.test(message)) return 'PLAYER_REMOVED';
  if (/AI가.*이어받/.test(message)) return 'SEAT_TAKEN_OVER';
  return null;
}

export const sessionEndMessages = {
  ROOM_NOT_FOUND: '방이 종료되었거나 더 이상 존재하지 않습니다. 로비로 이동했습니다.',
  PLAYER_REMOVED: '이 방의 참가가 종료되었습니다. 로비로 이동했습니다.',
  SEAT_TAKEN_OVER: '재접속 시간이 지나 AI가 자리를 이어받았습니다. 로비로 이동했습니다.',
  SESSION_INVALID: '이전 방의 접속 정보를 확인할 수 없습니다. 다시 입장해 주세요.',
};
