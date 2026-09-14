import { createContext, useContext } from 'react';
import { PhysicalStep } from './physicalSequence';
export const PhysicalTableContext = createContext<PhysicalStep | null>(null);
export function useHiddenHand(playerId: string) {
  const step = useContext(PhysicalTableContext);
  const all = !!step && (
    (['ROUND_GATHER', 'ROUND_REVEAL', 'ROUND_RESULT'].includes(step.kind) && !!step.cards?.[playerId]) ||
    (['BORROW', 'REVIEW', 'CONCEAL', 'RETURN', 'REVEAL', 'DISCARD_HAND'].includes(step.kind) && step.targetId === playerId) ||
    (['SWAP', 'COMPARE_GATHER', 'COMPARE_REVEAL', 'COMPARE_RESULT', 'COMPARE_SETTLE'].includes(step.kind) && [step.actorId, step.targetId].includes(playerId)));
  return { all, playedCardId: step?.kind === 'PLAY' && step.actorId === playerId ? step.card?.id : undefined,
    playing: step?.kind === 'PLAY' && step.actorId === playerId };
}
