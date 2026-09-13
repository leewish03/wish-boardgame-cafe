import { PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { PresentationAction } from './useActionTimeline';
import { buildPhysicalSequence } from './physicalSequence';
import { playerCopy } from '../ui/playerCopy';

export interface ActionNarrative { title: string; detail?: string; result?: string; }

const hasFinalConsonant = (word: string) => {
  const code = word.codePointAt(word.length - 1) || 0;
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
};
const subjectParticle = (word: string) => `${word}${hasFinalConsonant(word) ? '이' : '가'}`;

function resultCopy(summary: any, players: PlayerPublic[], localUserId: string, actorId?: string, targetId?: string) {
  const actor = playerCopy(players, actorId, localUserId);
  const target = targetId ? playerCopy(players, targetId, localUserId) : null;
  const eliminated = summary?.eliminatedPlayerId ? playerCopy(players, summary.eliminatedPlayerId, localUserId) : null;
  const revealedName = summary?.revealedCard?.name;
  const guessedName = summary?.guessValue
    ? ({ 2:'사제', 3:'남작', 4:'하녀', 5:'왕자', 6:'국왕', 7:'백작부인', 8:'공주' } as Record<number,string>)[summary.guessValue]
    : undefined;

  switch (summary?.resultType) {
    case 'GUARD_SUCCESS':
      return `추측 성공 · ${target?.possessive || '상대의'} 카드는 ${revealedName || guessedName || '추측한 카드'} · 탈락`;
    case 'GUARD_FAILED':
      return `${target?.possessive || '상대의'} 카드는 ${subjectParticle(guessedName || '추측한 카드')} 아닙니다.`;
    case 'PRIEST_REVEAL':
      return `${actor.subject} ${target?.possessive || '상대의'} 손패를 확인했습니다.`;
    case 'BARON_WIN':
    case 'BARON_LOSS': {
      if (summary.eliminatedPlayerId === localUserId) return '남작 비교에서 내가 패배해 탈락했습니다.';
      if (actorId === localUserId && summary.eliminatedPlayerId !== localUserId) return `남작 비교에서 내가 승리했습니다 · ${eliminated?.name || '상대'} 탈락`;
      return `남작 비교 · ${eliminated?.name || '패배한 플레이어'} 탈락`;
    }
    case 'BARON_TIE': return '남작 비교 결과 카드 숫자가 같습니다.';
    case 'HANDMAID_PROTECT': return actorId === localUserId ? '다음 내 차례까지 보호됩니다.' : `${actor.name}님이 다음 차례까지 보호됩니다.`;
    case 'PRINCE_PRINCESS_ELIMINATED': return targetId === localUserId ? '내 공주가 버려져 탈락했습니다.' : `공주가 버려져 ${target?.name || '상대'} 탈락`;
    case 'PRINCE_DISCARD': return `${target?.subject || '상대가'} ${revealedName || '손패'} 카드를 버리고 새로 뽑았습니다.`;
    case 'KING_SWAP': return `${actor.subject} ${target?.possessive || '상대의'} 손패와 맞바꿨습니다.`;
    // Countess has no public effect. Whether it was forced or a bluff is
    // hidden information, so do not imply a resolution or its reason.
    case 'COUNTESS_PLAY': return '백작부인을 사용했습니다.';
    case 'PRINCESS_ELIMINATED': return actorId === localUserId ? '내가 공주를 사용해 탈락했습니다.' : `${actor.name}님이 공주를 사용해 탈락했습니다.`;
    case 'TARGET_INVALID_NOOP': return '지목 가능한 상대가 없어 카드 효과가 무효화되었습니다.';
    case 'CARD_PLAYED': return `${actor.subject} 카드를 사용했습니다.`;
    default: return undefined;
  }
}

/**
 * One presentation action owns one sentence. This prevents the newest server
 * snapshot from replacing the card name while an older action is still moving.
 */
export function deriveActionNarrative(action: PresentationAction | null | undefined, players: PlayerPublic[], localUserId: string, targetPlayerId?: string | null): ActionNarrative | null {
  if (!action) return null;
  const events = action.presentationEvents || [];
  const step = buildPhysicalSequence(events)[action.presentationIndex || 0];
  const first = events[0]?.event as any;
  const played = events.find((item) => (item.event as any).type === 'CARD_PLAYED')?.event as any;
  const summary: any = action.presentation || first?.presentation;
  const actorId = played?.actorId || summary?.actorId || step?.actorId || first?.playerId;
  const targetId = targetPlayerId || step?.targetId || played?.targetId || summary?.targetId;
  const actor = playerCopy(players, actorId, localUserId);
  const target = targetId ? playerCopy(players, targetId, localUserId) : null;
  const card = played?.card || summary?.card || first?.card || first?.playedCard;

  if (first?.drawReason === 'ROUND_DEAL' || action.actionId.startsWith('round_deal_') || action.actionId.startsWith('deal_')) {
    return { title: '새 라운드 패를 나누는 중', detail: first?.playerId ? `${playerCopy(players, first.playerId, localUserId).name}에게 카드 1장` : undefined };
  }
  if (first?.type === 'CARD_DRAWN' && !played) {
    const player = playerCopy(players, first.playerId, localUserId);
    return { title: `${player.subject} 카드 1장 뽑음` };
  }
  if (step?.kind === 'TARGET' && target) return { title: `${actor.subject} ${target.object} 지목`, detail: card?.name ? `${card.name} 사용` : undefined };
  if (step?.kind === 'RESULT_DWELL' && summary) return { title: `${actor.name} · ${card?.name || '카드'} 사용`, result: resultCopy(summary, players, localUserId, actorId, targetId) };
  if (step?.kind === 'REVIEW' && target) return { title: `${actor.subject} ${target.possessive} 카드를 확인 중` };
  if (card) return { title: `${actor.name} · ${card.name || card.value} 사용`, detail: target ? `${target.object} 대상으로 선택` : undefined };
  return { title: actorId === localUserId ? '내 행동을 확인하는 중' : `${actor.possessive} 행동을 확인하는 중` };
}
