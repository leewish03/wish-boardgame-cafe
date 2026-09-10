import { GameEventEnvelope } from './envelopes';
import { CardInstance } from '../../love-letter-core/src/types';

export type PhysicalKind = 'PLAY' | 'TARGET' | 'BORROW' | 'REVIEW' | 'CONCEAL' | 'RETURN' | 'REVEAL' | 'DISCARD_HAND' | 'DRAW' | 'SWAP' | 'COMPARE' | 'COMPARE_REVIEW' | 'RESTORE' | 'PROTECT' | 'HOLD' | 'RESULT_DWELL' | 'CLEANUP' | 'ROUND_REVEAL';
export interface PhysicalStep {
  id: string; kind: PhysicalKind; actorId: string; targetId?: string;
  card?: CardInstance; cards?: Record<string, CardInstance>; apply?: any; duration: number;
}

/** Wire aliases describe facts; they are never independent visual actions. */
export function buildPhysicalSequence(envelopes: GameEventEnvelope[]): PhysicalStep[] {
  if (!envelopes.length) return [];
  const events = envelopes.map(e => e.event as any);
  const outcome = events.find(e => e.type === 'ROUND_ENDED');
  if (outcome) {
    const ids = Object.keys(outcome.winnerCards || {});
    return ids.length ? [{ id: envelopes[0].actionId, kind: 'ROUND_REVEAL', actorId: ids[0], cards: outcome.winnerCards, duration: 2 }] : [];
  }
  const summary = envelopes[0].presentation;
  const played = events.find(e => e.type === 'CARD_PLAYED');
  const actorId = played?.actorId || events[0].playerId;
  const targetId = events.find(e => e.type === 'PLAYER_TARGETED')?.targetId || summary?.targetId || undefined;
  const steps: PhysicalStep[] = [];
  const add = (kind: PhysicalKind, fields: Partial<PhysicalStep> = {}) => steps.push({ id: `${envelopes[0].actionId}:${steps.length}:${kind}`, kind, actorId, targetId, duration: .65, ...fields });
  if (played) add('PLAY', { card: played.card, apply: { ...played, type: 'HAND_TO_PLAY' } });
  if (targetId) add('TARGET', { duration: .45 });
  const priest = events.find(e => e.type === 'PRIEST_USED');
  const swap = events.find(e => e.type === 'HANDS_SWAPPED');
  const comparison = events.find(e => e.type === 'BARON_COMPARED');
  if (priest) {
    add('BORROW', { card: priest.revealedCard });
    add('REVIEW', { card: priest.revealedCard, duration: 1.5 });
    add('CONCEAL', { duration: .3 });
    add('RETURN');
  }
  if (comparison) {
    add('COMPARE', { duration: .7 });
    add('COMPARE_REVIEW', { duration: 1.5 });
    add('RESTORE', { duration: .7 });
  }
  if (swap) add('SWAP', { apply: swap, duration: .85 });
  for (const event of events) {
    if (event.type === 'PRINCE_DISCARDED') {
      add('REVEAL', { targetId: event.targetId, card: event.discardedCard, duration: .8 });
      add('DISCARD_HAND', { targetId: event.targetId, card: event.discardedCard, apply: event });
    }
    if (event.type === 'PLAYER_ELIMINATED') {
      for (const card of event.discardedCards || []) {
        add('REVEAL', { targetId: event.playerId, card, duration: .8 });
        add('DISCARD_HAND', { targetId: event.playerId, card, apply: { type: 'PRINCE_DISCARDED', targetId: event.playerId, discardedCard: card } });
      }
      add('HOLD', { targetId: event.playerId, apply: event, duration: .4 });
    }
    if (event.type === 'CARD_DRAWN') add('DRAW', { targetId: event.playerId, card: event.card, apply: event });
    if (event.type === 'PLAYER_PROTECTED') add('PROTECT', { apply: event, duration: .5 });
  }
  if (played) {
    // Reading the resolved outcome is part of the presentation, not a hidden
    // delay. The server-side presentation gate remains closed until it ends.
    add('RESULT_DWELL', { duration: 3 });
    add('CLEANUP', { card: played.card, apply: { ...played, type: 'PLAY_TO_DISCARD' } });
  }
  return steps;
}
