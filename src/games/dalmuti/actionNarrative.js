import { DALMUTI_RANKS } from '../../../packages/dalmuti-core/src/index.js';

export function dalmutiActionNarrative(event, players, myId) {
  if (!event) return null;
  const name = (id) => id === myId ? '나' : players.find((player) => player.id === id)?.nickname || '플레이어';
  const actor = name(event.actorId);
  switch (event.type) {
    case 'SET_PLAYED': return {
      title: `${actor} · ${event.rank === 13 ? 'J' : event.rank} ${DALMUTI_RANKS[event.rank]} ${event.count}장 제출`,
      detail: event.handCount === 0 ? '손패를 모두 냈습니다 · 이번 라운드 순위 확정' : event.wasLead ? `이번 더미는 ${event.count}장씩 · 더 낮은 숫자로 이기세요` : `${event.topRank}보다 낮은 ${event.rank} · ${event.count}장으로 교체`,
    };
    case 'PASSED': return { title: `${actor} · 패스`, detail: '카드는 그대로 · 다음 플레이어가 이어갑니다' };
    case 'TRICK_CLEARED': return { title: '모두 패스 · 중앙 더미 정리', detail: `${actor}부터 새로 시작 · 같은 숫자의 장수를 자유롭게 선택` };
    case 'ROUND_DEALT': return { title: '카드를 나누는 중', detail: '손패를 먼저 모두 내면 높은 신분을 얻습니다' };
    case 'OPENING_READY': return { title: `${actor}부터 시작`, detail: '달무티(1) 보유자가 첫 차례 · 같은 숫자끼리 냅니다' };
    case 'PLAY_STARTED': return { title: `${actor}부터 시작`, detail: '같은 숫자를 모아 내세요 · 숫자가 낮을수록 강합니다' };
    case 'TAX_REQUESTED': return { title: `${actor} · 반환 카드 선택`, detail: '낮은 신분은 강한 카드를, 높은 신분은 선택한 카드를 교환합니다' };
    case 'TAX_COMPLETED': return { title: '세금 교환 완료', detail: '달무티 ↔ 농노 2장 · 총리대신 ↔ 소작농 1장' };
    case 'REVOLUTION': return { title: `${actor} · 혁명`, detail: '이번 라운드는 세금 없이 진행합니다' };
    case 'GREAT_REVOLUTION': return { title: `${actor} · 대혁명`, detail: '신분 순서를 뒤집습니다 · 이번 라운드는 세금이 없습니다' };
    case 'MERCHANT_EXCHANGED': return { title: `${actor} ↔ ${name(event.targetId)} 교환`, detail: '무작위 카드 1장을 서로 바꿉니다' };
    case 'ROUND_ENDED': return { title: '라운드 종료', detail: '패를 모두 낸 순서로 다음 신분이 정해집니다' };
    case 'MATCH_ENDED': return { title: '매치 종료', detail: '누적 점수로 최종 우승자를 정합니다' };
    default: return null;
  }
}
