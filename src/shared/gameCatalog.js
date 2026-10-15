export const GAME_CATALOG = {
  LOVE_LETTER: { name: '러브레터', min: 2, max: 6, protocol: 'game' },
  DALMUTI: { name: '달무티', min: 4, max: 8, protocol: 'dalmuti' },
  SIX_NIMMT: { name: '젝스 님트', min: 2, max: 10, protocol: 'board', cover: 'six-nimmt', subtitle: '동시에 선택하고, 여섯 번째 카드를 피하세요.', description: '네 줄의 카드 사이에서 상대의 선택을 읽으세요. 황소 벌점을 가장 적게 모은 사람이 승리합니다.', rules: '전술 규칙: 인원수×10+4장 · 66점 도달 라운드에 종료' },
  WHITECHAPEL: { name: '화이트채플에서 온 편지', min: 2, max: 6, protocol: 'board', hiddenMovement: true, cover: 'whitechapel', subtitle: '1888년 런던 · 네 밤의 추적', description: '잭은 골목 사이로 은신처에 돌아가고, 다섯 수사관은 남겨진 흔적으로 그의 경로를 좁힙니다.', rules: '네 밤 · 잭 1명과 수사관 5개 말' },
  WHITEHALL: { name: '화이트홀 미스터리', min: 2, max: 4, protocol: 'board', hiddenMovement: true, cover: 'whitehall', subtitle: '템스 강변 · 세 구간의 추격', description: '잭의 비밀 목적지를 따라 세 수사관이 포위망을 좁힙니다. 마차, 골목, 배로 추적을 벗어나세요.', rules: '세 구간 · 구간마다 최대 15회 이동' },
};

export function gameEvent(gameType, action) {
  const game = GAME_CATALOG[gameType];
  return game ? `${game.protocol}:${action}` : null;
}

export function roomRules(room) {
  if (room?.gameType === 'LOVE_LETTER') return `목표 토큰 ${room.targetTokens || 4}개`;
  if (room?.gameType === 'DALMUTI') return `${room.roundCount || 10}라운드`;
  return GAME_CATALOG[room?.gameType]?.rules || '지원하지 않는 게임';
}

export function waitingRole(room, playerId) {
  if (!GAME_CATALOG[room?.gameType]?.hiddenMovement) return null;
  const players = room.players || [];
  const jackId = room.hostRole === 'INVESTIGATOR' ? players.find(player => player.id !== room.hostId)?.id : room.hostId;
  if (playerId === jackId) return '잭 · 비밀 이동';
  const investigators = players.filter(player => player.id !== jackId);
  const index = investigators.findIndex(player => player.id === playerId);
  const pawnCount = room.gameType === 'WHITEHALL' ? 3 : 5;
  const controlled = Array.from({ length: pawnCount }, (_, pawn) => pawn).filter(pawn => pawn % investigators.length === index).length;
  return `수사관 · ${controlled}개 말 담당`;
}
