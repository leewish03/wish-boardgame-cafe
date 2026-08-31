import { useState, useRef, useCallback, useEffect } from 'react';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { PresentationPhase } from '../machines/presentationMachine';

export function useActionTimeline() {
  const [currentAction, setCurrentAction] = useState<GameEventEnvelope | null>(null);
  const [phase, setPhase] = useState<PresentationPhase>('IDLE');
  const queueRef = useRef<GameEventEnvelope[]>([]);
  const isPlayingRef = useRef(false);
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<any[]>([]);

  const clearAllTimers = () => {
    timerRef.current.forEach(t => clearTimeout(t));
    timerRef.current = [];
  };

  const getPhaseTimings = (cardValue?: number) => {
    switch (cardValue) {
      case 1: // Guard
        return { card: 350, target: 350, effect: 450, result: 600, discard: 300, settle: 250 };
      case 2: // Priest
        return { card: 350, target: 350, effect: 600, result: 500, discard: 250, settle: 150 };
      case 3: // Baron
        return { card: 350, target: 350, effect: 650, result: 700, discard: 300, settle: 250 };
      case 4: // Handmaid
        return { card: 350, target: 150, effect: 550, result: 400, discard: 200, settle: 150 };
      case 5: // Prince
        return { card: 350, target: 350, effect: 550, result: 600, discard: 250, settle: 200 };
      case 6: // King
        return { card: 350, target: 350, effect: 800, result: 450, discard: 250, settle: 200 };
      case 7: // Countess
        return { card: 350, target: 100, effect: 450, result: 350, discard: 350, settle: 200 };
      case 8: // Princess
        return { card: 350, target: 100, effect: 500, result: 650, discard: 200, settle: 200 };
      default:
        return { card: 350, target: 300, effect: 500, result: 450, discard: 250, settle: 200 };
    }
  };

  const processNext = useCallback(() => {
    if (isPlayingRef.current || queueRef.current.length === 0) return;

    isPlayingRef.current = true;
    const next = queueRef.current.shift()!;
    setCurrentAction(next);

    const cardVal = (next.event as any)?.card?.value || (next.event as any)?.guessedCard?.value;
    const timings = getPhaseTimings(cardVal);

    // Sequence: WHO/CARD -> TARGET -> EFFECT -> RESULT -> DISCARDING -> SETTLING -> IDLE
    setPhase('CARD_PLAYING');

    let accumulatedTime = timings.card;

    const t1 = setTimeout(() => {
      setPhase('TARGET_REVEAL');
    }, accumulatedTime);
    timerRef.current.push(t1);

    accumulatedTime += timings.target;
    const t2 = setTimeout(() => {
      setPhase('EFFECT');
    }, accumulatedTime);
    timerRef.current.push(t2);

    accumulatedTime += timings.effect;
    const t3 = setTimeout(() => {
      setPhase('RESULT');
    }, accumulatedTime);
    timerRef.current.push(t3);

    accumulatedTime += timings.result;
    const t4 = setTimeout(() => {
      setPhase('DISCARDING');
    }, accumulatedTime);
    timerRef.current.push(t4);

    accumulatedTime += timings.discard;
    const t5 = setTimeout(() => {
      setPhase('SETTLING');
    }, accumulatedTime);
    timerRef.current.push(t5);

    accumulatedTime += timings.settle;
    const t6 = setTimeout(() => {
      isPlayingRef.current = false;
      setCurrentAction(null);
      setPhase('IDLE');
      processNext();
    }, accumulatedTime);
    timerRef.current.push(t6);
  }, []);

  const enqueueAction = useCallback((envelope: GameEventEnvelope) => {
    if (!envelope || !envelope.eventId) return;

    // Deduplication check: prevent re-playing the exact same eventId
    if (processedEventIdsRef.current.has(envelope.eventId)) {
      return;
    }
    processedEventIdsRef.current.add(envelope.eventId);

    queueRef.current.push(envelope);
    processNext();
  }, [processNext]);

  const resetTimeline = useCallback(() => {
    clearAllTimers();
    isPlayingRef.current = false;
    queueRef.current = [];
    setCurrentAction(null);
    setPhase('IDLE');
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  return {
    currentAction,
    phase,
    enqueueAction,
    resetTimeline,
    isActionPlaying: isPlayingRef.current || !!currentAction || queueRef.current.length > 0,
  };
}

