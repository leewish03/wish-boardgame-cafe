import { useState, useEffect, useRef, useCallback } from 'react';
import { createActor } from 'xstate';
import {
  gameInteractionMachine,
  GameInteractionContext,
  GameInteractionEvent,
} from './gameInteractionMachine';

export function useGameInteraction() {
  const actorRef = useRef<ReturnType<typeof createActor<typeof gameInteractionMachine>> | null>(null);

  if (!actorRef.current) {
    actorRef.current = createActor(gameInteractionMachine).start();
  }

  const [snapshot, setSnapshot] = useState(() => actorRef.current!.getSnapshot());

  useEffect(() => {
    const actor = actorRef.current!;
    const subscription = actor.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });

    return () => {
      subscription.unsubscribe();
      actor.stop();
    };
  }, []);

  const send = useCallback((event: GameInteractionEvent) => {
    if (actorRef.current) {
      actorRef.current.send(event);
    }
  }, []);

  return {
    state: snapshot.value as string,
    context: snapshot.context as GameInteractionContext,
    send,
    matches: (stateValue: string) => snapshot.matches(stateValue as any),
  };
}
