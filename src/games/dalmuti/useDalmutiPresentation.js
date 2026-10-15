import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { createPresentationState, enqueuePresentation, observePresentation, synchronizePresentation, completePresentation, replayOpeningPresentation } from './presentationState.js';

export function useDalmutiPresentation(socket, roomState) {
  const model = useRef(createPresentationState());
  const [, render] = useReducer((value) => value + 1, 0);
  const roomRef = useRef(roomState); roomRef.current = roomState;
  const syncRequested = useRef(false);
  const acknowledge = useCallback((eventId) => {
    if (socket?.connected && eventId) socket.emit('dalmuti:presentation-ack', { roomCode: roomRef.current?.code, eventId });
  }, [socket]);
  const requestSync = useCallback(() => {
    if (!socket?.connected || !roomRef.current?.code) return;
    syncRequested.current = true;
    socket.emit('dalmuti:view-ready', { roomCode: roomRef.current.code });
  }, [socket]);

  useLayoutEffect(() => {
    if (model.current.latest || !replayOpeningPresentation(model.current, roomState)) observePresentation(model.current, roomState);
    render();
  }, [roomState]);

  useEffect(() => {
    if (!model.current.current) synchronizePresentation(model.current, roomRef.current);
    let openingView = true;
    const onEvent = (envelope) => { enqueuePresentation(model.current, envelope); render(); };
    const onState = (room) => {
      if (room?.code !== roomRef.current?.code || !room.dalmuti) return;
      if (syncRequested.current) {
        syncRequested.current = false;
        if (openingView && model.current.current?.stateVersion === room.stateVersion) {
          observePresentation(model.current, room);
        } else if (!openingView || !replayOpeningPresentation(model.current, room)) {
          synchronizePresentation(model.current, room);
          acknowledge(room.presentationBatch?.eventId);
        }
        openingView = false;
      } else observePresentation(model.current, room);
      render();
    };
    const onDisconnect = () => { synchronizePresentation(model.current, roomRef.current); render(); };
    const onResize = () => { requestSync(); };
    socket?.on('dalmuti:event', onEvent);
    socket?.on('room:state', onState);
    socket?.on('connect', requestSync);
    socket?.on('disconnect', onDisconnect);
    window.addEventListener('resize', onResize);
    requestSync();
    return () => {
      socket?.off('dalmuti:event', onEvent); socket?.off('room:state', onState);
      socket?.off('connect', requestSync); socket?.off('disconnect', onDisconnect);
      window.removeEventListener('resize', onResize);
    };
  }, [socket, roomState?.code, acknowledge, requestSync]);

  // Only a recovery watchdog: motion completion controls normal sequencing.
  useEffect(() => {
    const state = model.current;
    if (!state.latest?.presentationPending || state.current || state.queue.length) return undefined;
    const timer = setTimeout(requestSync, 250);
    return () => clearTimeout(timer);
  }, [roomState, requestSync, model.current.current]);

  const finish = useCallback((eventId, generation) => {
    const ack = completePresentation(model.current, eventId, generation);
    if (ack) acknowledge(ack);
    render();
  }, [acknowledge]);
  return {
    visualRoom: model.current.display || roomState,
    active: model.current.current,
    busy: !!model.current.current || !!model.current.queue.length || !!roomState?.presentationPending,
    finish, requestSync,
  };
}
