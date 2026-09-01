import { useState, useRef, useCallback, useEffect } from 'react';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { PresentationPhase } from '../machines/presentationMachine';

export interface PresentationAction extends GameEventEnvelope {
  /** Every visual beat produced by one authoritative card command. */
  presentationEvents: GameEventEnvelope[];
  presentationIndex: number;
}

const SKIPPED_BEATS = new Set([
  'CARD_GUESSED', 'GUARD_SUCCEEDED', 'PRIEST_REVEALED', 'HANDMAID_PROTECTED', 'KING_SWAP',
]);

const isVisualBeat = (envelope: GameEventEnvelope) => !SKIPPED_BEATS.has((envelope.event as any).type);
const actionKey = (envelope: GameEventEnvelope) => envelope.actionId || envelope.eventId;
const resolutionBeat = (envelope: GameEventEnvelope) => [
  'PLAYER_TARGETED', 'GUARD_FAILED', 'GUARD_SUCCESS', 'GUARD_SUCCEEDED',
  'PRIEST_USED', 'BARON_COMPARED', 'PLAYER_PROTECTED', 'PRINCE_DISCARDED',
  'HANDS_SWAPPED', 'PLAYER_ELIMINATED',
].includes((envelope.event as any).type);

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

    // A command may create eight wire events. They describe one physical card
    // action, not eight turns. Show the played card and at most one meaningful
    // resolution beat; ActionStage still has the full aggregate for its copy.
    const nextIndex = current.presentationEvents.findIndex(resolutionBeat);
    if (phase === 'CARD_PLAYING' && nextIndex >= 0 && nextIndex !== current.presentationIndex) {
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
