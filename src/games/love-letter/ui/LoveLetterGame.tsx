import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { GameHud } from './GameHud';
import { OpponentRail } from './OpponentRail';
import { ActionStage } from './ActionStage';
import { LocalPlayerZone } from './PlayerZone';
import { GuessSelector } from './GuessSelector';
import { DiscardHistoryModal } from './DiscardHistoryModal';
import { RoundResultModal } from './RoundResultModal';
import { MatchResultModal } from './MatchResultModal';
import { PauseOverlay } from './PauseOverlay';
import { GameMenuDrawer } from './GameMenuDrawer';
import { SpatialMotionStage } from '../presentation/SpatialMotionStage';
import { TableAnchorProvider } from '../presentation/TableAnchorRegistry';
import { useActionTimeline } from '../presentation/useActionTimeline';
import { useVisualTableState } from '../presentation/useVisualTableState';
import { useGameSocket } from '../hooks/useGameSocket';
import { sfx } from '../../../shared/sfx';
import { THEME } from '../../../shared/theme';
import { GameState, CardValue, PlayerId, CardInstance } from '../../../../packages/love-letter-core/src/types';
import { calculateRemainingCards } from '../../../../packages/love-letter-core/src/selectors';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { buildPhysicalSequence } from '../presentation/physicalSequence';
import { PhysicalTableContext } from '../presentation/PhysicalTableContext';

export interface LoveLetterGameProps {
  // Support both direct legacy props from App.jsx and pure GameState
  roomState?: any;
  currentUser?: { id: string; nickname: string; avatarUrl?: string } | null;
  socket?: any;
  webrtc?: any;
  stt?: any;
  chatMessages?: any[];
  onSendChat?: (text: string) => void;
  onLeave?: () => void;

  // Pure props fallback
  gameState?: GameState;
  myUserId?: string;
  myHand?: CardInstance[];
  speakingUsers?: Record<string, boolean>;
  userSubtitles?: Record<string, { text: string; timestamp: number }>;
  isPaused?: boolean;
  pausedPlayerName?: string;
  onPlayCard?: (cardId: string, targetId?: string, guessValue?: number) => void;
  onStartNextRound?: () => void;
  onForfeit?: () => void;
  onLeaveRoom?: () => void;
}

export const LoveLetterGame: React.FC<LoveLetterGameProps> = ({
  roomState: propRoomState,
  currentUser,
  socket,
  webrtc,
  stt,
  chatMessages = [],
  onSendChat,
  onLeave,

  gameState: propGameState,
  myUserId: propMyUserId,
  myHand: propMyHand,
  speakingUsers: propSpeakingUsers,
  userSubtitles: propUserSubtitles,
  isPaused: propIsPaused,
  pausedPlayerName: propPausedPlayerName,
  onPlayCard: propOnPlayCard,
  onStartNextRound: propOnStartNextRound,
  onForfeit: propOnForfeit,
  onLeaveRoom: propOnLeaveRoom,
}) => {
  const activeUserId = currentUser?.id || propMyUserId || '';
  const handleLeaveCallback = onLeave || propOnLeaveRoom || propOnForfeit || (() => {});
  const [chatOpen, setChatOpen] = useState(false);
  const [frozenBoardHeight, setFrozenBoardHeight] = useState<number | null>(null);
  const handleChatOpenChange = useCallback((open: boolean) => {
    setChatOpen(open);
    setFrozenBoardHeight(open && typeof window !== 'undefined' ? window.innerHeight : null);
  }, []);

  // Presentation timeline
  const { currentAction, phase, enqueueAction, advancePresentation, resetTimeline, isActionPlaying, hasPendingPresentation } = useActionTimeline();

  // Socket adapter hook
  const gameSocket = useGameSocket({
    socket: socket || null,
    roomCode: propRoomState?.code,
    currentUser: currentUser || { id: activeUserId, nickname: '플레이어' },
    initialRoomState: propRoomState,
    onLeaveRoom: handleLeaveCallback,
    onGameEvent: enqueueAction,
    onPresentationCancel: resetTimeline,
  });

  // Resolved Game State & Hand
  const gameState: GameState = propGameState || gameSocket.gameState || {
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

  const myHand: CardInstance[] = propMyHand || gameSocket.myHand || [];
  const visual = useVisualTableState(gameState, myHand, activeUserId, isActionPlaying, hasPendingPresentation, (currentAction as any)?.before, currentAction?.actionId);
  const physicalSteps = buildPhysicalSequence(currentAction?.presentationEvents || []);
  const physicalStep = physicalSteps[currentAction?.presentationIndex || 0] || null;

  // Interactive UI States
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedGuessValue, setSelectedGuessValue] = useState<CardValue | null>(null);
  const [isGuessOpen, setIsGuessOpen] = useState(false);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const [interactionState, setInteractionState] = useState<string>('IDLE');
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [isAdvancingRound, setIsAdvancingRound] = useState(false);
  const [advanceRequestedVersion, setAdvanceRequestedVersion] = useState<number | null>(null);
  const [resultRequestError, setResultRequestError] = useState<string | null>(null);
  const [actionRequestError, setActionRequestError] = useState<string | null>(null);
  const submissionInFlightRef = useRef(false);

  // Modal States
  const [inspectingPlayer, setInspectingPlayer] = useState<{ name: string; discards: CardInstance[] } | null>(null);
  const me = gameState.players.find(p => p.id === activeUserId);
  const opponents = gameState.players.filter(p => p.id !== activeUserId);
  const isMyTurn = gameState.currentTurnPlayerId === activeUserId && !me?.isEliminated;
  // The server snapshot decides when input is legal.  Presentation remains on
  // screen to explain the previous action, but must never make the next human
  // turn feel stalled.
  const canInteract = !gameSocket.isPaused && isMyTurn && gameState.playPhase === 'TURN_INPUT' && !isActionPlaying && interactionState !== 'SUBMITTING' && gameSocket.isConnected;

  // A transport restoration invalidates DOM coordinates and any in-flight
  // projection. The next server snapshot is the only safe settled table.
  useEffect(() => {
    if (!gameSocket.isConnected) resetTimeline();
  }, [gameSocket.isConnected, resetTimeline]);

  // Sound effects on state transitions
  useEffect(() => {
    if (isMyTurn) {
      sfx.playTurnAlert();
    }
  }, [isMyTurn]);

  useEffect(() => {
    if (gameState.matchState === 'ROUND_END') {
      sfx.playSnipeSuccess();
      setSelectedCardId(null);
      setSelectedTargetId(null);
      setSelectedGuessValue(null);
      setIsGuessOpen(false);
      setInteractionState('IDLE');
    } else if (gameState.matchState === 'GAME_OVER') {
      sfx.playSnipeSuccess();
      setSelectedCardId(null);
      setSelectedTargetId(null);
      setSelectedGuessValue(null);
      setIsGuessOpen(false);
      setInteractionState('IDLE');
    }
  }, [gameState.matchState]);

  // A progress ACK means the server accepted the request, not that the next
  // round is visible yet.  Keep the result button locked until its snapshot
  // arrives, which prevents repeat taps during snapshot/room-state ordering.
  useEffect(() => {
    if (advanceRequestedVersion === null) return;
    if (gameState.stateVersion > advanceRequestedVersion && gameState.matchState !== 'ROUND_END') {
      setIsAdvancingRound(false);
      setAdvanceRequestedVersion(null);
    }
  }, [advanceRequestedVersion, gameState.stateVersion, gameState.matchState]);

  // Reset selection when turn ends
  useEffect(() => {
    if (!isMyTurn) {
      setSelectedCardId(null);
      setSelectedTargetId(null);
      setSelectedGuessValue(null);
      setIsGuessOpen(false);
      setInteractionState('IDLE');
    }
  }, [isMyTurn]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        sfx.stopSalonAmbience();
      } else {
        // The context is created only after a table interaction. This merely resumes
        // the user's existing setting after returning to the tab.
        sfx.unlockAndStart();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (interactionState !== 'SUBMITTING') return;
    if (gameState.lastAction?.actorId !== activeUserId) return;
    submissionInFlightRef.current = false;
    setSelectedCardId(null);
    setSelectedTargetId(null);
    setSelectedGuessValue(null);
    setIsGuessOpen(false);
    setInteractionState('IDLE');
  }, [interactionState, gameState.stateVersion, gameState.lastAction?.actorId, activeUserId]);

  const selectedCard = useMemo(() => {
    return myHand.find(c => c.id === selectedCardId) || null;
  }, [myHand, selectedCardId]);

  const targetablePlayerIds = useMemo(() => {
    if (!canInteract || !selectedCard) return [];
    const meta = CARD_DEFINITIONS[selectedCard.value as CardValue];
    if (!meta || !meta.needsTarget) return [];

    if (meta.canTargetSelf) {
      return gameState.players
        .filter(p => !p.isEliminated && (!p.isProtected || p.id === activeUserId))
        .map(p => p.id);
    }

    return opponents
      .filter(p => !p.isEliminated && !p.isProtected)
      .map(p => p.id);
  }, [canInteract, selectedCard, opponents, gameState.players, activeUserId]);

  const selectedCardMeta = selectedCard ? CARD_DEFINITIONS[selectedCard.value as CardValue] : null;
  const needsTarget = Boolean(selectedCardMeta?.needsTarget);
  const needsGuess = selectedCard?.value === 1;
  const requiresChosenTarget = needsTarget && targetablePlayerIds.length > 0;
  const canConfirmAction = Boolean(
    canInteract &&
    selectedCard &&
    interactionState !== 'SUBMITTING' &&
    (!requiresChosenTarget || selectedTargetId) &&
    (!needsGuess || !requiresChosenTarget || selectedGuessValue)
  );

  const allDiscards = useMemo(() => {
    return gameState.players.flatMap(p => p.discardPile || []);
  }, [gameState.players]);

  const remainingCounts = useMemo(() => {
    return calculateRemainingCards(allDiscards, myHand);
  }, [allDiscards, myHand]);

  // Execution dispatch wrapper
  const executePlayCard = useCallback(
    (cardId: string, targetId?: string, guessValue?: number) => {
      if (submissionInFlightRef.current) return;
      submissionInFlightRef.current = true;
      setInteractionState('SUBMITTING');
      setActionRequestError(null);
      if (propOnPlayCard) {
        propOnPlayCard(cardId, targetId, guessValue);
      } else {
        gameSocket.playCard(cardId, targetId, guessValue, result => {
          if (result.success) return;
          setSelectedCardId(null);
          setSelectedTargetId(null);
          setSelectedGuessValue(null);
          setIsGuessOpen(false);
          setInteractionState('IDLE');
          submissionInFlightRef.current = false;
          setActionRequestError(result.error || '카드를 사용하지 못했습니다. 다시 시도하세요.');
        });
      }
    },
    [propOnPlayCard, gameSocket]
  );

  // Card selection remains local until the player explicitly confirms it.
  const handleSelectCard = (card: CardInstance) => {
    if (!canInteract || me?.isEliminated) return;

    // Countess Rule Guard
    const hasCountess = myHand.some(c => c.value === 7);
    const hasPrinceOrKing = myHand.some(c => c.value === 5 || c.value === 6);
    if (hasCountess && hasPrinceOrKing && card.value !== 7) {
      sfx.playCardDraw();
      return;
    }

    if (selectedCardId === card.id) {
      // Toggle unselect
      setSelectedCardId(null);
      setSelectedTargetId(null);
      setSelectedGuessValue(null);
      setIsGuessOpen(false);
      setInteractionState('IDLE');
      return;
    }

    setSelectedCardId(card.id);
    setSelectedTargetId(null);
    setSelectedGuessValue(null);
    setIsGuessOpen(false);
    setActionRequestError(null);
    sfx.playCardDraw();

    const meta = CARD_DEFINITIONS[card.value as CardValue];

    // Untargeted cards use the same review-and-confirm step as every targeted
    // card. This prevents accidental Princess plays on touch screens.
    if (!meta || !meta.needsTarget) {
      setInteractionState('READY');
      return;
    }

    // Case 2: Targeted cards (Guard 1, Priest 2, Baron 3, Prince 5, King 6)
    const eligible = meta.canTargetSelf
      ? gameState.players.filter(p => !p.isEliminated && (!p.isProtected || p.id === activeUserId))
      : opponents.filter(p => !p.isEliminated && !p.isProtected);

    if (eligible.length === 0) {
      // The rules allow this card to be discarded without an effect, but the
      // player still gets a chance to review that consequence.
      setInteractionState('READY');
    } else {
      setInteractionState('TARGETING');
    }
  };

  const handleSelectTarget = (targetId: PlayerId) => {
    if (!canInteract || !selectedCardId || !selectedCard) return;

    setSelectedTargetId(targetId);

    if (selectedCard.value === 1) {
      setInteractionState('GUESSING');
      setIsGuessOpen(true);
    } else {
      setInteractionState('READY');
    }
  };

  const handleConfirmGuess = (guessVal: CardValue) => {
    if (!selectedCardId || !selectedTargetId) return;
    setSelectedGuessValue(guessVal);
    setIsGuessOpen(false);
    setInteractionState('READY');
  };

  const handleConfirmAction = () => {
    if (!selectedCard || !canConfirmAction) return;
    executePlayCard(selectedCard.id, selectedTargetId || undefined, selectedGuessValue || undefined);
  };

  const handleCancelAction = () => {
    setSelectedCardId(null);
    setSelectedTargetId(null);
    setSelectedGuessValue(null);
    setIsGuessOpen(false);
    setInteractionState('IDLE');
  };

  const handleInspectDiscards = (playerId: string) => {
    const player = gameState.players.find(p => p.id === playerId);
    if (player) {
      setInspectingPlayer({
        name: player.nickname,
        discards: player.discardPile || [],
      });
    }
  };

  const handleStartNextRound = () => {
    if (propOnStartNextRound) {
      propOnStartNextRound();
    } else {
      setIsAdvancingRound(true);
      setAdvanceRequestedVersion(gameState.stateVersion);
      setResultRequestError(null);
      const progress = gameState.matchState === 'GAME_OVER' ? gameSocket.startRematch : gameSocket.startNextRound;
      progress(gameState.stateVersion, result => {
        if (!result.success) {
          setIsAdvancingRound(false);
          setAdvanceRequestedVersion(null);
          setResultRequestError(result.error || '다음 라운드를 시작하지 못했습니다.');
        }
      });
    }
  };

  const handleForfeit = () => {
    if (propOnForfeit) {
      propOnForfeit();
    } else {
      gameSocket.forfeit();
    }
  };

  const handlePresentationComplete = useCallback(() => {
    if (physicalStep?.apply) visual.applyCompletedEvent(physicalStep.apply);
    // The final visible beat may be an elimination or a forced discard, which
    // has no actorId of its own. The action summary remains the authority for
    // deciding who is allowed to release the server-side presentation gate.
    const actionActorId = currentAction?.presentation?.actorId || (currentAction?.event as any)?.actorId;
    if (currentAction && physicalStep?.kind === 'CLEANUP' && actionActorId === activeUserId) {
      const isPriestReview = currentAction.presentation?.resultType === 'PRIEST_REVEAL';
      if (isPriestReview) {
        gameSocket.acknowledgePresentation(currentAction.actionId, currentAction.stateVersion, 'PRIVATE_REVIEW');
      } else {
        gameSocket.acknowledgePresentation(currentAction.actionId, currentAction.stateVersion, 'PUBLIC_SEQUENCE');
      }
    }
    advancePresentation();
  }, [activeUserId, advancePresentation, currentAction, gameSocket, phase, visual, physicalStep]);

  // Media controls resolution
  const speakingUsers = propSpeakingUsers ?? webrtc?.speakingUsers ?? {};
  const userSubtitles = propUserSubtitles ?? stt?.userSubtitles ?? {};

  const turnPlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayerId);
  const outcomeWinnerIds = gameState.roundWinnerIds?.length
    ? gameState.roundWinnerIds
    : gameState.outcome?.winnerIds || [];
  const roundWinner = gameState.players.find(p => outcomeWinnerIds.includes(p.id));
  const matchWinner = gameState.players.find(p => p.id === gameState.matchWinnerId);
  const targetPlayer = gameState.players.find(p => p.id === selectedTargetId);
  const selectedGuessName = selectedGuessValue ? CARD_DEFINITIONS[selectedGuessValue]?.name : null;
  const tableStatus = !gameSocket.isConnected
    ? '연결을 복구하는 중'
    : isActionPlaying
      ? '이전 행동을 보여주는 중'
      : interactionState === 'SUBMITTING'
        ? '서버에 행동을 확인하는 중'
        : isMyTurn
          ? '내 차례'
          : `${turnPlayer?.nickname || '상대'}의 차례`;

  const isPaused = propIsPaused ?? gameSocket.isPaused;
  const pausedPlayerName = propPausedPlayerName ?? gameSocket.pausedPlayerName ?? '플레이어';

  return (
    <TableAnchorProvider><PhysicalTableContext.Provider value={physicalStep}><BoardSurface $chatOpen={chatOpen} $frozenHeight={frozenBoardHeight} onPointerDown={() => sfx.unlockAndStart()}>
      {/* 1. TOP HUD (Section 3 Tier 1) */}
      <GameHud
        roundNumber={gameState.roundNumber}
        myTokens={me?.tokens || 0}
        targetTokens={gameState.config.targetTokens}
        turnPlayerNickname={turnPlayer?.nickname || '플레이어'}
        isMyTurn={isMyTurn}
        isConnected={gameSocket.isConnected}
        statusLabel={tableStatus}
        turnExpiresAt={gameState.turnExpiresAt}
        turnTimeoutSeconds={gameState.config.turnTimeoutSeconds}
        onOpenSettings={() => setMenuDrawerOpen(true)}
      />

      {/* Spatial Motion & VFX Stage */}
      <SpatialMotionStage
        currentAction={currentAction}
        localUserId={activeUserId}
        players={visual.visualTable.players}
        returnedActionId={gameSocket.returnedActionId}
        onReturnCard={(actionId,version,callback)=>gameSocket.acknowledgePresentation(actionId,version,'RETURN_REQUEST',callback)}
        onPhaseComplete={handlePresentationComplete}
      />

      {/* 2. OPPONENT RAIL (Section 3 Tier 2) */}
      <OpponentRail
        opponents={visual.visualTable.players.filter(p => p.id !== activeUserId)}
        currentTurnPlayerId={gameState.currentTurnPlayerId}
        targetablePlayerIds={targetablePlayerIds}
        selectedTargetId={selectedTargetId}
        presentationAction={null}
        speakingUsers={speakingUsers}
        userSubtitles={userSubtitles}
        onSelectTarget={handleSelectTarget}
        onInspectDiscards={handleInspectDiscards}
      />

      {/* 3 & 4. ACTION STAGE & DECK INFO (Section 3 Tier 3 & 4) */}
      <ActionStage
        deckCount={visual.visualTable.deckCount}
        setAsideCount={visual.visualTable.setAsideCount}
        players={visual.visualTable.players}
        localUserId={activeUserId}
        lastAction={isActionPlaying ? (gameState.lastAction || gameSocket.lastAction) : null}
        presentationAction={currentAction}
        presentationPhase={phase}
        interactionState={interactionState}
        actionError={actionRequestError}
        activeCard={isActionPlaying ? null : selectedCard}
        targetPlayerId={targetPlayer?.id}
        selectedGuessName={selectedGuessName}
        canConfirm={canConfirmAction}
        onConfirmAction={handleConfirmAction}
        onCancelAction={handleCancelAction}
      />

      {/* My public discard shelf is physically attached directly above my hand. */}
      {visual.visualTable.players.find(p => p.id === activeUserId) && (
          <LocalPlayerZone
            player={visual.visualTable.players.find(p => p.id === activeUserId)!}
            isCurrentTurn={isMyTurn}
            isTargetable={targetablePlayerIds.includes(activeUserId)}
            isSelectedTarget={selectedTargetId === activeUserId}
            isSpeaking={!!speakingUsers[activeUserId]}
            onSelect={() => handleSelectTarget(activeUserId)}
            onInspect={() => handleInspectDiscards(activeUserId)}
            presentationAction={null}
            hand={visual.visualTable.myHand}
            isMyTurn={isMyTurn}
            canSelectCards={canInteract}
            selectedCardId={selectedCardId}
            interactionState={interactionState}
            onSelectCard={handleSelectCard}
            onCancelSelection={handleCancelAction}
            chatMessages={chatMessages}
            onSendChat={onSendChat}
            onChatOpenChange={handleChatOpenChange}
          />
      )}

      {/* Modals & Bottom Sheets */}
      <GuessSelector
        isOpen={isGuessOpen}
        targetPlayerName={targetPlayer?.nickname || '상대방'}
        remainingCounts={remainingCounts}
        selectedGuessValue={selectedGuessValue}
        onSelectGuess={handleConfirmGuess}
        onCancel={handleCancelAction}
      />

      <DiscardHistoryModal
        isOpen={!!inspectingPlayer}
        playerName={inspectingPlayer?.name || ''}
        discardPile={inspectingPlayer?.discards || []}
        onClose={() => setInspectingPlayer(null)}
      />

      <RoundResultModal
        isOpen={gameState.matchState === 'ROUND_END' && !isActionPlaying}
        roundNumber={gameState.roundNumber}
        winnerName={roundWinner?.nickname || '승자'}
        winnerTokens={roundWinner?.tokens || 1}
        targetTokens={gameState.config?.targetTokens || 4}
        isHost={me?.isHost || false}
        onNextRound={handleStartNextRound}
        players={gameState.players}
        winnerIds={outcomeWinnerIds}
        winnerReason={gameState.roundWinnerReason || gameState.outcome?.reason}
        previousScores={gameState.outcome?.previousScores}
        winnerCards={gameState.outcome?.winnerCards}
        advanceAt={gameState.outcome?.advanceAt}
        canAdvanceAt={gameState.outcome?.canAdvanceAt}
        isRequesting={isAdvancingRound}
        requestError={resultRequestError}
      />

      <MatchResultModal
        isOpen={gameState.matchState === 'GAME_OVER' && !isActionPlaying}
        championName={matchWinner?.nickname || '최종 우승자'}
        targetTokens={gameState.config?.targetTokens || 4}
        onPlayAgain={me?.isHost ? handleStartNextRound : undefined}
        onReturnToLobby={handleLeaveCallback}
        players={gameState.players}
        isHost={me?.isHost || false}
        requestError={resultRequestError}
        isRequesting={isAdvancingRound}
        reason={gameState.outcome?.reason}
      />

      <PauseOverlay
        isPaused={isPaused}
        pausedPlayerName={pausedPlayerName}
        onForfeit={handleForfeit}
      />

      <GameMenuDrawer
        isOpen={menuDrawerOpen}
        roomCode={propRoomState?.code}
        targetTokens={gameState.config?.targetTokens || 4}
        onClose={() => setMenuDrawerOpen(false)}
        onLeaveRoom={handleLeaveCallback}
      />
    </BoardSurface></PhysicalTableContext.Provider></TableAnchorProvider>
  );
};

const BoardSurface = styled.div<{$chatOpen:boolean;$frozenHeight:number|null}>`
  position:relative;
  height:${p=>p.$chatOpen&&p.$frozenHeight ? `${p.$frozenHeight}px` : 'auto'};
  width: 100%;
  min-width: 0;
  min-height:${p=>p.$chatOpen&&p.$frozenHeight ? `${p.$frozenHeight}px` : '100dvh'};
  background-color: ${THEME.background};
  background-image: ${THEME.gradients.marbleBase};
  display:grid;
  grid-template-rows:auto auto minmax(100px, 1fr) auto;
  overflow-x: clip;
  user-select: none;
  box-sizing: border-box;
  font-family: ${THEME.font.sans};
  color: ${THEME.foreground};
`;

export default LoveLetterGame;
