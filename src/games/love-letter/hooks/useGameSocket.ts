import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, CardValue, PlayerId, CardInstance } from '../../../../packages/love-letter-core/src/types';
import { GameEventEnvelope, GameSnapshot } from '../../../../packages/protocol/src/envelopes';
import { SOCKET_EVENTS } from '../../../../packages/protocol/src/socketEvents';
import { sfx } from '../../../shared/sfx';

export interface UseGameSocketOptions {
  socket: Socket | null;
  roomCode?: string;
  currentUser?: { id: string; nickname: string; avatarUrl?: string } | null;
  initialRoomState?: any;
  onLeaveRoom?: () => void;
  onGameEvent?: (envelope: GameEventEnvelope) => void;
}

export interface UseGameSocketReturn {
  isConnected: boolean;
  gameState: GameState | null;
  myHand: CardInstance[];
  lastAction: any | null;
  priestSecret: { targetName: string; card: CardInstance } | null;
  clearPriestSecret: () => void;
  isPaused: boolean;
  pausedPlayerName: string | null;
  playCard: (cardId: string, targetId?: string, guessValue?: number) => void;
  startNextRound: () => void;
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

  // If it's already a pure GameState snapshot
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
    cardCount: Array.isArray(p.hand) ? p.hand.length : (p.handCount || (p.isEliminated ? 0 : 1)),
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
    name: '덱 카드',
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
      turnTimeoutSeconds: roomState.turnTimeLimit || 60,
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
    turnExpiresAt: Date.now() + ((roomState.turnTimeLimit || 60) * 1000),
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
}: UseGameSocketOptions): UseGameSocketReturn {
  const [isConnected, setIsConnected] = useState<boolean>(socket?.connected ?? false);
  const [rawRoomState, setRawRoomState] = useState<any>(initialRoomState || null);
  const [priestSecret, setPriestSecret] = useState<{ targetName: string; card: CardInstance } | null>(null);
  const [lastAction, setLastAction] = useState<any | null>(null);

  const myUserId = currentUser?.id || '';

  // Update raw room state when initialRoomState prop changes
  useEffect(() => {
    if (initialRoomState) {
      setRawRoomState(initialRoomState);
    }
  }, [initialRoomState]);

  // Socket event binding
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const handleRoomState = (state: any) => {
      if (state) {
        setRawRoomState(state);
      }
    };

    const handleGameSnapshot = (snapshot: GameSnapshot) => {
      if (snapshot && snapshot.game) {
        setRawRoomState({
          ...snapshot.game,
          mySecretHand: snapshot.mySecretHand,
        });
      }
    };

    const handleGameEvent = (envelope: GameEventEnvelope) => {
      if (envelope && envelope.event) {
        if (onGameEvent) onGameEvent(envelope);
      }
    };

    const handleActionResult = (actionData: any) => {
      setLastAction(actionData);
      sfx.playCardPlay();

      if (onGameEvent && actionData) {
        const envelope: GameEventEnvelope = {
          eventId: actionData.actionId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          actionId: actionData.actionId,
          stateVersion: 1,
          timestamp: actionData.timestamp || Date.now(),
          event: {
            type: actionData.resultType === 'GUARD_SUCCESS' ? 'GUARD_SUCCEEDED' :
                  actionData.resultType === 'GUARD_FAIL' ? 'GUARD_FAILED' :
                  actionData.resultType === 'BARON_WIN' || actionData.resultType === 'BARON_LOSE' || actionData.resultType === 'BARON_TIE' ? 'BARON_COMPARED' :
                  actionData.resultType === 'HANDMAID_PROTECT' ? 'HANDMAID_PROTECTED' :
                  actionData.resultType === 'PRINCE_DISCARD' || actionData.resultType === 'PRINCE_PRINCESS_ELIMINATED' ? 'PRINCE_DISCARDED' :
                  actionData.resultType === 'KING_SWAP' ? 'HANDS_SWAPPED' :
                  actionData.resultType === 'PRINCESS_SELF_ELIMINATED' ? 'PLAYER_ELIMINATED' :
                  'CARD_PLAYED',
            actorId: actionData.actorId,
            playerId: actionData.actorId,
            targetId: actionData.targetId,
            card: actionData.playedCard,
            guessValue: actionData.guessedCard?.value,
            guessedCard: actionData.guessedCard,
            revealedCard: actionData.revealedCard,
            discardedCard: actionData.revealedCard,
            reason: actionData.resultDescription,
          } as any,
        };
        onGameEvent(envelope);
      }
    };

    const handlePriestResult = (data: any) => {
      if (data && data.card) {
        setPriestSecret({
          targetName: data.targetName || data.targetPlayerName || '상대방',
          card: {
            id: data.card.id || `priest_card_${data.card.value}`,
            value: data.card.value || data.card.cardNumber || 1,
            name: data.card.name || '알 수 없음',
          },
        });
        sfx.playCardDeal();
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room:state', handleRoomState);
    socket.on(SOCKET_EVENTS.GAME_SNAPSHOT, handleGameSnapshot);
    socket.on(SOCKET_EVENTS.GAME_EVENT, handleGameEvent);
    socket.on('game:action-result', handleActionResult);
    socket.on('game:action-showcase', handleActionResult);
    socket.on('game:priest-result', handlePriestResult);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('room:state', handleRoomState);
      socket.off(SOCKET_EVENTS.GAME_SNAPSHOT, handleGameSnapshot);
      socket.off(SOCKET_EVENTS.GAME_EVENT, handleGameEvent);
      socket.off('game:action-result', handleActionResult);
      socket.off('game:action-showcase', handleActionResult);
      socket.off('game:priest-result', handlePriestResult);
    };
  }, [socket, onGameEvent]);

  // Derive GameState & Hand
  const { gameState, myHand } = adaptRoomStateToGameState(rawRoomState, myUserId);

  const clearPriestSecret = useCallback(() => {
    setPriestSecret(null);
  }, []);

  const playCard = useCallback(
    (cardId: string, targetId?: string, guessValue?: number) => {
      if (!socket) return;
      const code = roomCode || rawRoomState?.code;

      sfx.hapticSnap();
      sfx.playCardPlay();

      // Emit both pure command and legacy payload for maximum backward/forward compatibility
      socket.emit(
        'game:play-card',
        {
          roomCode: code,
          userId: myUserId,
          cardId,
          targetUserId: targetId || null,
          guessValue: guessValue || null,
        },
        (res: any) => {
          if (res && !res.success && res.error) {
            console.error('Play card error:', res.error);
          }
        }
      );

      socket.emit(
        SOCKET_EVENTS.GAME_COMMAND,
        {
          type: 'PLAY_CARD',
          roomCode: code,
          playerId: myUserId,
          cardId,
          targetPlayerId: targetId,
          guessedValue: guessValue,
        }
      );
    },
    [socket, roomCode, rawRoomState?.code, myUserId]
  );

  const startNextRound = useCallback(() => {
    if (!socket) return;
    const code = roomCode || rawRoomState?.code;
    socket.emit(
      'game:start',
      {
        roomCode: code,
        userId: myUserId,
      },
      (res: any) => {
        if (res && !res.success && res.error) {
          console.error('Start next round error:', res.error);
        }
      }
    );
  }, [socket, roomCode, rawRoomState?.code, myUserId]);

  const forfeit = useCallback(() => {
    if (!socket) return;
    const code = roomCode || rawRoomState?.code;
    socket.emit('room:leave', {
      roomCode: code,
      userId: myUserId,
    });
    if (onLeaveRoom) onLeaveRoom();
  }, [socket, roomCode, rawRoomState?.code, myUserId, onLeaveRoom]);

  const leaveRoom = useCallback(() => {
    forfeit();
  }, [forfeit]);

  const pausedPlayer = rawRoomState?.pausedPlayerId
    ? rawRoomState.players?.find((p: any) => p.id === rawRoomState.pausedPlayerId)?.nickname
    : null;

  return {
    isConnected,
    gameState,
    myHand,
    lastAction,
    priestSecret,
    clearPriestSecret,
    isPaused: !!rawRoomState?.isPaused,
    pausedPlayerName: pausedPlayer || '플레이어',
    playCard,
    startNextRound,
    forfeit,
    leaveRoom,
    rawRoomState,
  };
}
