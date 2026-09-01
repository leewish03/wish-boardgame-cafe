import { useState, useRef, useCallback, useEffect } from 'react';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { PresentationPhase } from '../machines/presentationMachine';

export interface PresentationAction extends GameEventEnvelope {
  /** Every visual beat produced by one authoritative card command. */
  presentationEvents: GameEventEnvelope[];
  presentationIndex: number;
}

// These are protocol-detail duplicates of a visible preceding beat. Every
// other event remains in the sequence: a card effect is not complete until
// discard, reveal/swap and replacement draw have all been explained.
const SKIPPED_BEATS = new Set(['CARD_GUESSED', 'GUARD_SUCCEEDED', 'PRIEST_REVEALED', 'HANDMAID_PROTECTED', 'KING_SWAP', 'CARD_DISCARDED', 'TURN_ENDED', 'TURN_STARTED']);

const isVisualBeat = (envelope: GameEventEnvelope) => !SKIPPED_BEATS.has((envelope.event as any).type);
const actionKey = (envelope: GameEventEnvelope) => envelope.actionId || envelope.eventId;
function createAction(envelope: GameEventEnvelope): PresentationAction {
  return { ...envelope, presentationEvents: [envelope], presentationIndex: 0 };
}

/**
 * Groups server events by actionId. The engine remains authoritative; this only
 * keeps an actor → card → target → result story readable before the next action.
 */
export function useActionTimeline() {
  const [currentAction, setCurrentAction] = useState<PresentationAction | null>(null);
  const [phase, setPhase] = useState<PresentationPhase>('IDLE');
  const [isActionPlaying, setIsActionPlaying] = useState(false);
  const queueRef = useRef<PresentationAction[]>([]);
  const currentRef = useRef<PresentationAction | null>(null);
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const scheduledStartRef = useRef(false);

  const startNext = useCallback(() => {
    const next = queueRef.current.shift() || null;
    currentRef.current = next;
    setCurrentAction(next);
    setIsActionPlaying(!!next);
    setPhase(next ? 'CARD_PLAYING' : 'IDLE');
  }, []);

  const scheduleStart = useCallback(() => {
    if (scheduledStartRef.current || currentRef.current) return;
    scheduledStartRef.current = true;
    Promise.resolve().then(() => {
      scheduledStartRef.current = false;
      if (!currentRef.current) startNext();
    });
  }, [startNext]);

  const appendTo = useCallback((action: PresentationAction, envelope: GameEventEnvelope) => {
    if (!isVisualBeat(envelope)) return action;
    return { ...action, presentationEvents: [...action.presentationEvents, envelope] };
  }, []);

  const enqueueAction = useCallback((envelope: GameEventEnvelope) => {
    if (!envelope?.eventId || processedEventIdsRef.current.has(envelope.eventId) || !isVisualBeat(envelope)) return;
    processedEventIdsRef.current.add(envelope.eventId);
    const key = actionKey(envelope);

    if (currentRef.current && actionKey(currentRef.current) === key) {
      const updated = appendTo(currentRef.current, envelope);
      currentRef.current = updated;
      setCurrentAction(updated);
      return;
    }

    const queuedIndex = queueRef.current.findIndex(action => actionKey(action) === key);
    if (queuedIndex >= 0) {
      queueRef.current[queuedIndex] = appendTo(queueRef.current[queuedIndex], envelope);
    } else {
      queueRef.current.push(createAction(envelope));
    }
    scheduleStart();
  }, [appendTo, scheduleStart]);

  const advancePresentation = useCallback(() => {
    const current = currentRef.current;
    if (!current) return startNext();

    // Each entry is one causal beat. Do not collapse a Prince discard, an
    // elimination, a King swap or a replacement draw into a generic result.
    const nextIndex = current.presentationIndex + 1;
    if (nextIndex < current.presentationEvents.length) {
      const nextEvent = current.presentationEvents[nextIndex];
      const updated = { ...current, presentationIndex: nextIndex, event: nextEvent.event, eventId: nextEvent.eventId };
      currentRef.current = updated;
      setCurrentAction(updated);
      setPhase('CARD_PLAYING');
      return;
    }

    if (phase !== 'RESULT') {
      setPhase('RESULT');
      return;
    }

    currentRef.current = null;
    setCurrentAction(null);
    setIsActionPlaying(false);
    setPhase('IDLE');
    startNext();
  }, [phase, startNext]);

  const resetTimeline = useCallback(() => {
    queueRef.current = [];
    currentRef.current = null;
    setCurrentAction(null);
    setIsActionPlaying(false);
    setPhase('IDLE');
  }, []);

  useEffect(() => {
    const settle = () => resetTimeline();
    window.addEventListener('resize', settle);
    window.addEventListener('orientationchange', settle);
    return () => {
      window.removeEventListener('resize', settle);
      window.removeEventListener('orientationchange', settle);
    };
  }, [resetTimeline]);

  return { currentAction, phase, enqueueAction, advancePresentation, resetTimeline, isActionPlaying };
}
