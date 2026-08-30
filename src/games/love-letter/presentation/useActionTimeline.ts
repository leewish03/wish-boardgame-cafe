import { useState, useEffect, useRef } from 'react';
import { GameEventEnvelope } from '../../../packages/protocol/src/envelopes';

export interface ActionQueueItem {
  id: string;
  envelope: GameEventEnvelope;
  status: 'PENDING' | 'PLAYING' | 'FINISHED';
}

export function useActionTimeline() {
  const [currentAction, setCurrentAction] = useState<GameEventEnvelope | null>(null);
  const queueRef = useRef<GameEventEnvelope[]>([]);
  const isPlayingRef = useRef(false);

  const enqueueAction = (envelope: GameEventEnvelope) => {
    queueRef.current.push(envelope);
    processNext();
  };

  const processNext = () => {
    if (isPlayingRef.current || queueRef.current.length === 0) return;

    isPlayingRef.current = true;
    const next = queueRef.current.shift()!;
    setCurrentAction(next);

    // Each action presentation lasts at least 1.1 seconds so players observe the physical cause & effect
    setTimeout(() => {
      isPlayingRef.current = false;
      setCurrentAction(null);
      processNext();
    }, 1100);
  };

  return {
    currentAction,
    enqueueAction,
    isActionPlaying: !!currentAction,
  };
}
