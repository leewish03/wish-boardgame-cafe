import { PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { PresentationAction } from './useActionTimeline';
import { buildPhysicalSequence } from './physicalSequence';
import { playerCopy } from '../ui/playerCopy';

export interface ActionNarrative { title: string; detail?: string; result?: string; }

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

  if (action.actionId.startsWith('deal_')) {
    return { title: '새 라운드 패를 나누는 중', detail: first?.playerId ? `${playerCopy(players, first.playerId, localUserId).name}에게 카드 1장` : undefined };
  }
  if (first?.type === 'CARD_DRAWN' && !played) {
    const player = playerCopy(players, first.playerId, localUserId);
    return { title: `${player.subject} 카드 1장 뽑음` };
  }
  if (step?.kind === 'TARGET' && target) return { title: `${actor.subject} ${target.object} 지목`, detail: card?.name ? `${card.name} 효과` : undefined };
  if (step?.kind === 'RESULT_DWELL' && summary?.description) return { title: `${actor.name} · ${card?.name || '카드'} 사용`, result: summary.description };
  if (step?.kind === 'REVIEW' && target) return { title: `${actor.subject} ${target.possessive} 카드를 확인 중` };
  if (card) return { title: `${actor.name} · ${card.name || card.value} 사용`, detail: target ? `${target.name} 대상` : undefined };
  return { title: `${actor.name}의 행동을 확인하는 중` };
}
