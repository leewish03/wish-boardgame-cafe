import { useState, useRef, useCallback, useEffect } from 'react';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { PresentationPhase } from '../machines/presentationMachine';

const NEXT_PHASE: Record<PresentationPhase, PresentationPhase> = {
  IDLE: 'CARD_PLAYING', CARD_PLAYING: 'TARGET_REVEAL', TARGET_REVEAL: 'EFFECT',
  EFFECT: 'RESULT', RESULT: 'DISCARDING', DISCARDING: 'SETTLING', SETTLING: 'IDLE',
};

export function useActionTimeline() {
  const [currentAction, setCurrentAction] = useState<GameEventEnvelope | null>(null);
  const [phase, setPhase] = useState<PresentationPhase>('IDLE');
  const [isActionPlaying, setIsActionPlaying] = useState(false);
  const queueRef = useRef<GameEventEnvelope[]>([]);
  const currentRef = useRef<GameEventEnvelope | null>(null);
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  const start = useCallback((action: GameEventEnvelope) => {
    currentRef.current = action;
    setCurrentAction(action);
    setIsActionPlaying(true);
    setPhase('CARD_PLAYING');
  }, []);

  const enqueueAction = useCallback((envelope: GameEventEnvelope) => {
    if (!envelope?.eventId || processedEventIdsRef.current.has(envelope.eventId)) return;
    processedEventIdsRef.current.add(envelope.eventId);
    if (currentRef.current) queueRef.current.push(envelope);
    else start(envelope);
  }, [start]);

  const advancePresentation = useCallback(() => {
    setPhase(previous => {
      const event: any = currentRef.current?.event;
      let next = NEXT_PHASE[previous];
      if (previous === 'CARD_PLAYING' && !event?.targetId) next = 'RESULT';
      if (previous === 'SETTLING') {
        const queued = queueRef.current.shift() || null;
        currentRef.current = queued;
        setCurrentAction(queued);
        setIsActionPlaying(!!queued);
        return queued ? 'CARD_PLAYING' : 'IDLE';
      }
      return next;
    });
  }, []);

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
