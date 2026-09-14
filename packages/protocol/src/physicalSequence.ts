import { GameEventEnvelope } from './envelopes';
import { CardInstance } from '../../love-letter-core/src/types';

export type PhysicalKind = 'PLAY' | 'TARGET' | 'BORROW' | 'REVIEW' | 'CONCEAL' | 'RETURN' | 'REVEAL' | 'DISCARD_HAND' | 'DRAW' | 'SWAP' | 'PROTECT' | 'HOLD' | 'RESULT_DWELL' | 'CLEANUP' | 'COMPARE_GATHER' | 'COMPARE_REVEAL' | 'COMPARE_RESULT' | 'COMPARE_SETTLE' | 'ROUND_GATHER' | 'ROUND_REVEAL' | 'ROUND_RESULT';
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
    const cards = outcome.revealedHands || outcome.winnerCards || {};
    const ids = Object.keys(cards);
    if (!ids.length || !(outcome.winnerIds || []).length) return [];
    return [
      { id: `${envelopes[0].actionId}:0:ROUND_GATHER`, kind: 'ROUND_GATHER', actorId: ids[0], cards, apply: outcome, duration: .5 },
      { id: `${envelopes[0].actionId}:1:ROUND_REVEAL`, kind: 'ROUND_REVEAL', actorId: ids[0], cards, apply: outcome, duration: .35 },
      { id: `${envelopes[0].actionId}:2:ROUND_RESULT`, kind: 'ROUND_RESULT', actorId: ids[0], cards, apply: outcome, duration: 3 },
    ];
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
    const elimination = events.find(e => e.type === 'PLAYER_ELIMINATED' && e.playerId === comparison.eliminatedId);
    const loserCard = elimination?.discardedCards?.[0];
    add('COMPARE_GATHER', { apply: comparison, duration: .5 });
    add('COMPARE_REVEAL', { apply: comparison, card: loserCard, duration: .35 });
    add('COMPARE_RESULT', { apply: comparison, card: loserCard, duration: 3 });
    if (played) add('CLEANUP', { card: played.card, apply: { ...played, type: 'PLAY_TO_DISCARD' }, duration: .45 });
    add('COMPARE_SETTLE', {
      apply: elimination ? { type: 'COMPARE_SETTLED', playerId: comparison.eliminatedId, discardedCard: loserCard, eliminatedId: comparison.eliminatedId, discardOrdinal: loserCard ? elimination.discardOrdinals?.[loserCard.id] : undefined } : comparison,
      card: loserCard,
      duration: .55,
    });
    return steps;
  }
  if (swap) add('SWAP', { apply: swap, duration: .85 });
  if (played) {
    // The played card is always the first public discard. Move it before a
    // forced discard so the physical sequence matches the authoritative pile.
    add('RESULT_DWELL', { duration: 3 });
    add('CLEANUP', { card: played.card, apply: { ...played, type: 'PLAY_TO_DISCARD' }, duration: .45 });
  }
  for (const event of events) {
    if (event.type === 'PRINCE_DISCARDED') {
      add('REVEAL', { targetId: event.targetId, card: event.discardedCard, duration: .8 });
      add('DISCARD_HAND', { targetId: event.targetId, card: event.discardedCard, apply: event });
    }
    if (event.type === 'PLAYER_ELIMINATED') {
      for (const card of event.discardedCards || []) {
        add('REVEAL', { targetId: event.playerId, card, duration: .8 });
        add('DISCARD_HAND', { targetId: event.playerId, card, apply: { type: 'PRINCE_DISCARDED', targetId: event.playerId, discardedCard: card, discardOrdinal: event.discardOrdinals?.[card.id] } });
      }
      add('HOLD', { targetId: event.playerId, apply: event, duration: .4 });
    }
    if (event.type === 'CARD_DRAWN') add('DRAW', { targetId: event.playerId, card: event.card, apply: event });
    if (event.type === 'PLAYER_PROTECTED') add('PROTECT', { apply: event, duration: .5 });
  }
  return steps;
}
