import { useState, useRef, useCallback, useEffect } from 'react';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { PresentationPhase } from '../machines/presentationMachine';

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
    const queued = queueRef.current.shift() || null;
    currentRef.current = queued;
    setCurrentAction(queued);
    setIsActionPlaying(!!queued);
    setPhase(queued ? 'CARD_PLAYING' : 'IDLE');
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
