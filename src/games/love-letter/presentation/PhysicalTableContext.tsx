import { createContext, useContext } from 'react';
import { PhysicalStep } from './physicalSequence';
export const PhysicalTableContext = createContext<PhysicalStep | null>(null);
export function useHiddenHand(playerId: string) {
  const step = useContext(PhysicalTableContext);
  const all = !!step && (
    (step.kind === 'ROUND_REVEAL' && !!step.cards?.[playerId]) ||
    (['BORROW', 'REVIEW', 'CONCEAL', 'RETURN', 'REVEAL', 'DISCARD_HAND'].includes(step.kind) && step.targetId === playerId) ||
    (['SWAP', 'COMPARE', 'COMPARE_REVIEW', 'RESTORE'].includes(step.kind) && [step.actorId, step.targetId].includes(playerId)));
  return { all, playedCardId: step?.kind === 'PLAY' && step.actorId === playerId ? step.card?.id : undefined,
    playing: step?.kind === 'PLAY' && step.actorId === playerId };
}
