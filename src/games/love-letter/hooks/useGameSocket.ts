import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, CardValue, PlayerId, CardInstance } from '../../../../packages/love-letter-core/src/types';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { GameSnapshot } from '../../../../packages/protocol/src/types';
import { SOCKET_EVENTS } from '../../../../packages/protocol/src/socketEvents';
import { sfx } from '../../../shared/sfx';

export interface UseGameSocketOptions {
  socket: Socket | null;
  roomCode?: string;
  currentUser?: { id: string; nickname: string; avatarUrl?: string } | null;
  initialRoomState?: any;
  onLeaveRoom?: () => void;
  onGameEvent?: (envelope: GameEventEnvelope) => void;
  onPresentationCancel?: () => void;
}

export interface UseGameSocketReturn {
  returnedActionId: string | null;
  isConnected: boolean;
  gameState: GameState | null;
  myHand: CardInstance[];
  lastAction: any | null;
  acknowledgePresentation: (actionId: string, expectedStateVersion: number, completedPhase: 'PUBLIC_SEQUENCE' | 'PRIVATE_REVIEW' | 'RETURN_REQUEST', callback?: (result: { success: boolean; error?: string }) => void) => void;
  isPaused: boolean;
  pausedPlayerName: string | null;
  playCard: (cardId: string, targetId?: string, guessValue?: number, callback?: (result: { success: boolean; error?: string }) => void) => void;
  startNextRound: (expectedStateVersion?: number, callback?: (result: { success: boolean; error?: string }) => void) => void;
  startRematch: (expectedStateVersion?: number, callback?: (result: { success: boolean; error?: string }) => void) => void;
  forfeit: () => void;
  leaveRoom: () => void;
  rawRoomState: any | null;
}

/**
 * Adapter function to convert legacy roomState (from server/shared/roomManager.js)
 * into standard GameState for the new v2 UI architecture.
 */
export function adaptRoomStateToGameState(roomState: any, myUserId: string): { gameState: GameState; myHand: CardInstance[] } {
  if (!roomState) {
    const defaultState: GameState = {
      matchState: 'LOBBY',
      playPhase: 'ROUND_START',
      roundNumber: 1,
      config: { targetTokens: 4, turnTimeoutSeconds: 60, maxPlayers: 4, minPlayers: 2 },
      players: [],
      secrets: {},
      deck: [],
      setAsideCard: null,
      currentTurnPlayerId: null,
      turnStartedAt: Date.now(),
      turnExpiresAt: Date.now() + 60000,
      lastAction: null,
      stateVersion: 1,
      matchWinnerId: null,
      roundWinnerIds: [],
    };
    return { gameState: defaultState, myHand: [] };
  }

  // Protocol snapshots contain PublicGameState plus the receiver's own hand.
  // Keep that privacy boundary intact in the client state.
  if (roomState.deckCount !== undefined && roomState.matchState && roomState.players && roomState.config) {
    return {
      gameState: {
        ...roomState,
        deck: [],
        secrets: {},
        setAsideCard: null,
      } as GameState,
      myHand: roomState.mySecretHand || [],
    };
  }

  // If it's already a legacy full GameState snapshot
  if (roomState.matchState && roomState.players && roomState.config) {
    const myPlayer = roomState.players.find((p: any) => p.id === myUserId);
    const myHand = (roomState.secrets && roomState.secrets[myUserId]?.hand) || myPlayer?.hand || [];
    return { gameState: roomState, myHand };
  }

  // Convert legacy server roomState to GameState
  const myPlayer = (roomState.players || []).find((p: any) => p.id === myUserId);
  const myHand: CardInstance[] = (myPlayer?.hand || []).map((c: any, idx: number) => ({
    id: c.id || `card_${c.value || c.cardNumber}_${idx}`,
    value: (c.value || c.cardNumber || 1) as CardValue,
    name: c.name || '알 수 없음',
  }));

  const players = (roomState.players || []).map((p: any) => ({
    id: p.id,
    nickname: p.nickname || p.name || '플레이어',
    avatar: p.avatarUrl || p.picture || p.avatar || '👑',
    tokens: p.tokens || p.score || 0,
    isReady: !!p.isReady,
    isHost: p.id === roomState.hostId || !!p.isHost,
    isBot: !!p.isBot,
    isEliminated: !!p.isEliminated || (p.isAlive === false),
    isProtected: !!p.isProtected,
    cardCount: p.handCount ?? p.cardCount ?? (Array.isArray(p.hand) ? p.hand.length : (p.isEliminated ? 0 : 1)),
    discardPile: (p.discardPile || p.discards || []).map((c: any, idx: number) => ({
      id: c.id || `disc_${p.id}_${idx}`,
      value: (c.value || c.cardNumber || 1) as CardValue,
      name: c.name || '알 수 없음',
    })),
  }));

  let matchState: 'LOBBY' | 'PLAYING' | 'ROUND_END' | 'GAME_OVER' = 'LOBBY';
  if (roomState.gameState === 'PLAYING' || roomState.gameState === 'IN_PROGRESS') {
    matchState = 'PLAYING';
  } else if (roomState.gameState === 'ROUND_END') {
    matchState = 'ROUND_END';
  } else if (roomState.gameState === 'GAME_OVER') {
    matchState = 'GAME_OVER';
  } else if (roomState.gameState === 'LOBBY') {
    matchState = 'LOBBY';
  }

  // Create virtual deck placeholder
  const deckLength = roomState.deckCount ?? (Array.isArray(roomState.deck) ? roomState.deck.length : 16);
  const deck: CardInstance[] = Array.from({ length: deckLength }).map((_, i) => ({
    id: `deck_${i}`,
    value: 1,
    name: '경비병',
  }));

  const lastAction = roomState.lastActionDetail || (roomState.lastActionLog ? {
    actionId: `act_${Date.now()}`,
    actorId: roomState.turnPlayerId || '',
    card: { id: 'last_card', value: 1, name: '카드' },
    resultType: 'INFO',
    description: roomState.lastActionLog,
  } : null);

  const gameState: GameState = {
    matchState,
    playPhase: 'TURN_INPUT',
    roundNumber: roomState.roundNumber || 1,
    config: {
      targetTokens: roomState.targetTokens || 4,
      turnTimeoutSeconds: roomState.turnTimeLimit ?? 60,
      maxPlayers: roomState.maxPlayers || 4,
      minPlayers: 2,
    },
    players,
    secrets: {
      [myUserId]: { id: myUserId, hand: myHand },
    },
    deck,
    setAsideCard: roomState.setAsideSecretCard || null,
    currentTurnPlayerId: roomState.turnPlayerId || null,
    turnStartedAt: Date.now(),
    turnExpiresAt: roomState.turnTimeLimit === 0 ? 0 : Date.now() + ((roomState.turnTimeLimit ?? 60) * 1000),
    lastAction,
    stateVersion: roomState.stateVersion || 1,
    matchWinnerId: roomState.gameWinner?.id || roomState.matchWinnerId || null,
    roundWinnerIds: roomState.roundWinner ? [roomState.roundWinner.id || roomState.roundWinner] : [],
  };

  return { gameState, myHand };
}

export function useGameSocket({
  socket,
  roomCode,
  currentUser,
  initialRoomState,
  onLeaveRoom,
  onGameEvent,
  onPresentationCancel,
}: UseGameSocketOptions): UseGameSocketReturn {
  const [isConnected, setIsConnected] = useState<boolean>(socket?.connected ?? false);
  const [rawRoomState, setRawRoomState] = useState<any>(initialRoomState || null);
  const [lastAction, setLastAction] = useState<any | null>(null);
  const latestStateVersionRef = useRef(0);
  const latestSnapshotRef = useRef<any>(null);
  const seenRound = useRef<number | null>(null);
  const pendingDraws = useRef<GameEventEnvelope[]>([]);
  const outcomeVersion = useRef<number | null>(null);
  const [returnedActionId, setReturnedActionId] = useState<string | null>(null);

  const myUserId = currentUser?.id || '';

  // Update raw room state when initialRoomState prop changes
  useEffect(() => {
    if (initialRoomState) {
      const snapshot = latestSnapshotRef.current;
      if (snapshot && snapshot.matchState && snapshot.matchState !== 'LOBBY') {
        setRawRoomState((previous: any) => ({
          ...snapshot,
          code: initialRoomState.code || snapshot.code,
          hostId: initialRoomState.hostId || snapshot.hostId,
          isPaused: initialRoomState.isPaused,
          pausedPlayerId: initialRoomState.pausedPlayerId,
          pauseExpiresAt: initialRoomState.pauseExpiresAt,
        }));
      } else {
        setRawRoomState(initialRoomState);
      }
    }
  }, [initialRoomState]);

  // Socket event binding
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit(SOCKET_EVENTS.GAME_VIEW_READY);
    };
    const handleDisconnect = () => { setIsConnected(false); pendingDraws.current = []; };

    const handleRoomState = (state: any) => {
      if (state) {
        // A room projection intentionally omits private/result fields.  Never let
        // it replace an active authoritative game snapshot, even if unrelated
        // room metadata advanced its own version (chat, host, presence).
        const snapshot = latestSnapshotRef.current;
        if (snapshot && snapshot.matchState && snapshot.matchState !== 'LOBBY') {
          setRawRoomState((previous: any) => ({
            ...snapshot,
            code: state.code || snapshot.code,
            hostId: state.hostId || snapshot.hostId,
            isPaused: state.isPaused,
            pausedPlayerId: state.pausedPlayerId,
            pauseExpiresAt: state.pauseExpiresAt,
            chatMessages: state.chatMessages,
          }));
          return;
        }
        setRawRoomState(state);
      }
    };

    const handleGameSnapshot = (snapshot: GameSnapshot) => {
      if (!snapshot?.publicState || snapshot.stateVersion < latestStateVersionRef.current) return;
      latestStateVersionRef.current = snapshot.stateVersion;
      if (!snapshot.presentation && !snapshot.publicState.lastAction && snapshot.publicState.matchState === 'PLAYING' && seenRound.current !== snapshot.publicState.roundNumber) {
        const state = snapshot.publicState;
        const total = state.players.reduce((sum, p) => sum + p.cardCount, 0);
        const id = `deal_${snapshot.stateVersion}`;
        const before = { ...state, players: state.players.map(p => ({ ...p, cardCount: 0 })), deckCount: state.deckCount + total, mySecretHand: [] };
        let remaining = state.deckCount + total;
        for (let slot = 0; slot < 2; slot++) for (const p of state.players) {
          if (p.cardCount <= slot) continue;
          onGameEvent?.({ eventId: `${id}:${p.id}:${slot}`, actionId: `${id}:${p.id}:${slot}`, before: slot === 0 && p.id === state.players[0].id ? before : undefined, stateVersion: snapshot.stateVersion,
            timestamp: snapshot.serverTime, event: { type: 'CARD_DRAWN', playerId: p.id, card: p.id === myUserId ? snapshot.privateState?.hand[slot] : undefined, remainingDeckCount: --remaining } } as any);
        }
      } else if (!snapshot.presentation && seenRound.current === snapshot.publicState.roundNumber) {
        pendingDraws.current.forEach(envelope => onGameEvent?.(envelope));
      }
      pendingDraws.current = [];
      if (!snapshot.presentation && snapshot.publicState.outcome?.winnerCards && outcomeVersion.current !== snapshot.stateVersion && ['ROUND_END','GAME_OVER'].includes(snapshot.publicState.matchState)) {
        outcomeVersion.current = snapshot.stateVersion;
        onGameEvent?.({ eventId: `outcome_${snapshot.stateVersion}`, actionId: `outcome_${snapshot.stateVersion}`, stateVersion: snapshot.stateVersion, timestamp: snapshot.serverTime,
          event: { type: 'ROUND_ENDED', winnerCards: snapshot.publicState.outcome.winnerCards } } as any);
      }
      seenRound.current = snapshot.publicState.roundNumber;
      if (snapshot.presentation) {
        const pending = snapshot.presentation;
        if (pending.returnRequested) setReturnedActionId(pending.actionId);
        const before = { ...pending.before.publicState, mySecretHand: pending.before.privateState.hand };
        pending.events.forEach(envelope => onGameEvent?.({ ...envelope, before, event: { ...envelope.event, presentation: envelope.presentation } } as any));
      }
      setLastAction(snapshot.publicState.lastAction || null);
      const nextState = {
        ...snapshot.publicState,
        code: roomCode,
        hostId: snapshot.publicState.players?.find((player: any) => player.isHost)?.id,
        mySecretHand: snapshot.privateState?.hand || [],
      };
      latestSnapshotRef.current = nextState;
      setRawRoomState(nextState);
    };

    const handleGameEvent = (envelope: GameEventEnvelope) => {
      // Card actions arrive atomically in snapshot.presentation. Only standalone
      // turn draws use the event stream, so aliases cannot create extra motions.
      if (!envelope?.actionId?.startsWith('draw_') || seenRound.current === null) return;
      pendingDraws.current.push(envelope);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room:state', handleRoomState);
    socket.on(SOCKET_EVENTS.GAME_SNAPSHOT, handleGameSnapshot);
    socket.on(SOCKET_EVENTS.GAME_EVENT, handleGameEvent);
    const handleReturn = (data: { actionId: string }) => setReturnedActionId(data.actionId);
    socket.on('game:presentation-return', handleReturn);
    if (onPresentationCancel) socket.on('game:presentation-cancel', onPresentationCancel);
    if (socket.connected) socket.emit(SOCKET_EVENTS.GAME_VIEW_READY);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('room:state', handleRoomState);
      socket.off(SOCKET_EVENTS.GAME_SNAPSHOT, handleGameSnapshot);
      socket.off(SOCKET_EVENTS.GAME_EVENT, handleGameEvent);
      socket.off('game:presentation-return', handleReturn);
      if (onPresentationCancel) socket.off('game:presentation-cancel', onPresentationCancel);
    };
  }, [socket, onGameEvent, onPresentationCancel, roomCode]);

  // Derive GameState & Hand
  const { gameState, myHand } = useMemo(() => adaptRoomStateToGameState(rawRoomState, myUserId), [rawRoomState, myUserId]);

  const acknowledgePresentation = useCallback((actionId: string, expectedStateVersion: number, completedPhase: 'PUBLIC_SEQUENCE' | 'PRIVATE_REVIEW' | 'RETURN_REQUEST', callback?: (result: { success: boolean; error?: string }) => void) => {
    if (!socket?.connected) {
      callback?.({ success: false, error: '게임 서버에 연결되어 있지 않습니다.' });
      return;
    }
    socket.emit(SOCKET_EVENTS.GAME_PRESENTATION_ACK, {
      roomCode: roomCode || rawRoomState?.code,
      userId: myUserId,
      actionId,
      expectedStateVersion,
      completedPhase,
    }, (result: any) => callback?.(result || { success: false, error: '서버 응답을 받지 못했습니다.' }));
  }, [socket, roomCode, rawRoomState?.code, myUserId]);

  const playCard = useCallback(
    (cardId: string, targetId?: string, guessValue?: number, callback?: (result: { success: boolean; error?: string }) => void) => {
      if (!socket?.connected) {
        callback?.({ success: false, error: '게임 서버에 연결되어 있지 않습니다.' });
        return;
      }
      const code = roomCode || rawRoomState?.code;

      sfx.hapticSnap();
      sfx.playCardPlay();

      socket.emit(
        SOCKET_EVENTS.GAME_COMMAND,
        {
          roomCode: code,
          userId: myUserId,
          commandId: `cmd_${Date.now()}`,
          timestamp: Date.now(),
          command: { type: 'PLAY_CARD', cardId, targetId, guessValue },
        },
        (res: any) => {
          if (res && !res.success && res.error) {
            console.error('Play card error:', res.error);
          }
          callback?.(res || { success: false, error: '서버 응답을 받지 못했습니다.' });
        }
      );
    },
    [socket, roomCode, rawRoomState?.code, myUserId]
  );

  const startNextRound = useCallback((expectedStateVersion?: number, callback?: (result: { success: boolean; error?: string }) => void) => {
    if (!socket) {
      callback?.({ success: false, error: '게임 서버에 연결되어 있지 않습니다.' });
      return;
    }
    const code = roomCode || rawRoomState?.code;
    socket.emit(
      SOCKET_EVENTS.GAME_ADVANCE,
      {
        roomCode: code,
        userId: myUserId,
        expectedStateVersion,
        requestId: `advance_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      },
      (res: any) => {
        if (res && !res.success && res.error) {
          console.error('Start next round error:', res.error);
        }
        callback?.(res || { success: false, error: '서버 응답을 받지 못했습니다.' });
      }
    );
  }, [socket, roomCode, rawRoomState?.code, myUserId]);

  const startRematch = useCallback((expectedStateVersion?: number, callback?: (result: { success: boolean; error?: string }) => void) => {
    if (!socket) {
      callback?.({ success: false, error: '게임 서버에 연결되어 있지 않습니다.' });
      return;
    }
    socket.emit(SOCKET_EVENTS.GAME_REMATCH, {
      roomCode: roomCode || rawRoomState?.code,
      userId: myUserId,
      expectedStateVersion,
      requestId: `rematch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    }, (res: any) => callback?.(res || { success: false, error: '서버 응답을 받지 못했습니다.' }));
  }, [socket, roomCode, rawRoomState?.code, myUserId]);

  const forfeit = useCallback(() => {
    if (!socket) return;
    const code = roomCode || rawRoomState?.code;
    socket.emit('room:forfeit', { roomCode: code, userId: myUserId });
  }, [socket, roomCode, rawRoomState?.code, myUserId, onLeaveRoom]);

  const leaveRoom = useCallback(() => {
    if (!socket) return;
    socket.emit('room:leave', { roomCode: roomCode || rawRoomState?.code, userId: myUserId });
  }, [socket, roomCode, rawRoomState?.code, myUserId]);

  const pausedPlayer = rawRoomState?.pausedPlayerId
    ? rawRoomState.players?.find((p: any) => p.id === rawRoomState.pausedPlayerId)?.nickname
    : null;

  return {
    isConnected,
    returnedActionId,
    gameState,
    myHand,
    lastAction,
    acknowledgePresentation,
    isPaused: !!rawRoomState?.isPaused,
    pausedPlayerName: pausedPlayer || '플레이어',
    playCard,
    startNextRound,
    startRematch,
    forfeit,
    leaveRoom,
    rawRoomState,
  };
}
