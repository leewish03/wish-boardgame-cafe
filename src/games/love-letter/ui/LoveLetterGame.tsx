import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { GameHud } from './GameHud';
import { OpponentRail } from './OpponentRail';
import { ActionStage } from './ActionStage';
import { PlayerHand } from './PlayerHand';
import { PlayerSeat } from './PlayerSeat';
import { GuessSelector } from './GuessSelector';
import { DiscardHistoryModal } from './DiscardHistoryModal';
import { PriestSecretModal } from './PriestSecretModal';
import { RoundResultModal } from './RoundResultModal';
import { MatchResultModal } from './MatchResultModal';
import { PauseOverlay } from './PauseOverlay';
import { GameMenuDrawer } from './GameMenuDrawer';
import { SpatialMotionStage } from '../presentation/SpatialMotionStage';
import { useActionTimeline } from '../presentation/useActionTimeline';
import { useGameSocket } from '../hooks/useGameSocket';
import { sfx } from '../../../shared/sfx';
import { THEME } from '../../../shared/theme';
import { GameState, CardValue, PlayerId, CardInstance } from '../../../../packages/love-letter-core/src/types';
import { calculateRemainingCards } from '../../../../packages/love-letter-core/src/selectors';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';

export interface LoveLetterGameProps {
  // Support both direct legacy props from App.jsx and pure GameState
  roomState?: any;
  currentUser?: { id: string; nickname: string; avatarUrl?: string } | null;
  socket?: any;
  webrtc?: any;
  stt?: any;
  onLeave?: () => void;

  // Pure props fallback
  gameState?: GameState;
  myUserId?: string;
  myHand?: CardInstance[];
  speakingUsers?: Record<string, boolean>;
  userSubtitles?: Record<string, { text: string; timestamp: number }>;
  isMicOn?: boolean;
  isSpeakerOn?: boolean;
  isSTTActive?: boolean;
  isPaused?: boolean;
  pausedPlayerName?: string;
  onToggleMic?: () => void;
  onToggleSpeaker?: () => void;
  onToggleSTT?: () => void;
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
  onLeave,

  gameState: propGameState,
  myUserId: propMyUserId,
  myHand: propMyHand,
  speakingUsers: propSpeakingUsers,
  userSubtitles: propUserSubtitles,
  isMicOn: propIsMicOn,
  isSpeakerOn: propIsSpeakerOn,
  isSTTActive: propIsSTTActive,
  isPaused: propIsPaused,
  pausedPlayerName: propPausedPlayerName,
  onToggleMic: propOnToggleMic,
  onToggleSpeaker: propOnToggleSpeaker,
  onToggleSTT: propOnToggleSTT,
  onPlayCard: propOnPlayCard,
  onStartNextRound: propOnStartNextRound,
  onForfeit: propOnForfeit,
  onLeaveRoom: propOnLeaveRoom,
}) => {
  const activeUserId = currentUser?.id || propMyUserId || '';
  const handleLeaveCallback = onLeave || propOnLeaveRoom || propOnForfeit || (() => {});

  // Presentation timeline
  const { currentAction, phase, enqueueAction, isActionPlaying } = useActionTimeline();

  // Socket adapter hook
  const gameSocket = useGameSocket({
    socket: socket || null,
    roomCode: propRoomState?.code,
    currentUser: currentUser || { id: activeUserId, nickname: '플레이어' },
    initialRoomState: propRoomState,
    onLeaveRoom: handleLeaveCallback,
    onGameEvent: enqueueAction,
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

  // Interactive UI States
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isGuessOpen, setIsGuessOpen] = useState(false);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const [interactionState, setInteractionState] = useState<string>('IDLE');
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [isAdvancingRound, setIsAdvancingRound] = useState(false);
  const [advanceRequestedVersion, setAdvanceRequestedVersion] = useState<number | null>(null);
  const [resultRequestError, setResultRequestError] = useState<string | null>(null);

  // Modal States
  const [inspectingPlayer, setInspectingPlayer] = useState<{ name: string; discards: CardInstance[] } | null>(null);
  const [priestSecret, setPriestSecret] = useState<{ targetName: string; card: CardInstance } | null>(null);

  // Sync priest peek from socket hook
  useEffect(() => {
    // The reveal is already private in the socket payload. Delay only its
    // presentation so it does not cover the card → target → discard sequence.
    if (gameSocket.priestSecret && !isActionPlaying) {
      setPriestSecret(gameSocket.priestSecret);
    }
  }, [gameSocket.priestSecret, isActionPlaying]);

  const me = gameState.players.find(p => p.id === activeUserId);
  const opponents = gameState.players.filter(p => p.id !== activeUserId);
  const isMyTurn = gameState.currentTurnPlayerId === activeUserId && !me?.isEliminated;
  const canInteract = isMyTurn && !isActionPlaying;

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
      setIsGuessOpen(false);
      setInteractionState('IDLE');
    } else if (gameState.matchState === 'GAME_OVER') {
      sfx.playSnipeSuccess();
      setSelectedCardId(null);
      setSelectedTargetId(null);
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
    setSelectedCardId(null);
    setSelectedTargetId(null);
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

  const allDiscards = useMemo(() => {
    return gameState.players.flatMap(p => p.discardPile || []);
  }, [gameState.players]);

  const remainingCounts = useMemo(() => {
    return calculateRemainingCards(allDiscards, myHand);
  }, [allDiscards, myHand]);

  // Execution dispatch wrapper
  const executePlayCard = useCallback(
    (cardId: string, targetId?: string, guessValue?: number) => {
      setInteractionState('SUBMITTING');
      if (propOnPlayCard) {
        propOnPlayCard(cardId, targetId, guessValue);
      } else {
        gameSocket.playCard(cardId, targetId, guessValue);
      }
    },
    [propOnPlayCard, gameSocket]
  );

  // Card Selection & Auto Execution
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
      setInteractionState('IDLE');
      return;
    }

    setSelectedCardId(card.id);
    sfx.playCardDraw();

    const meta = CARD_DEFINITIONS[card.value as CardValue];

    // Case 1: Untargeted cards (Handmaid 4, Countess 7, Princess 8)
    if (!meta || !meta.needsTarget) {
      executePlayCard(card.id);
      return;
    }

    // Case 2: Targeted cards (Guard 1, Priest 2, Baron 3, Prince 5, King 6)
    const eligible = meta.canTargetSelf
      ? gameState.players.filter(p => !p.isEliminated && (!p.isProtected || p.id === activeUserId))
      : opponents.filter(p => !p.isEliminated && !p.isProtected);

    if (eligible.length === 0) {
      // No valid targets (all opponents protected by Handmaid) -> discard without effect
      executePlayCard(card.id);
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
      executePlayCard(selectedCardId, targetId);
    }
  };

  const handleConfirmGuess = (guessVal: CardValue) => {
    if (!selectedCardId || !selectedTargetId) return;
    executePlayCard(selectedCardId, selectedTargetId, guessVal);
    setIsGuessOpen(false);
  };

  const handleCancelAction = () => {
    setSelectedCardId(null);
    setSelectedTargetId(null);
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

  // Media controls resolution
  const isMicOn = propIsMicOn ?? webrtc?.isMicOn ?? false;
  const isSpeakerOn = propIsSpeakerOn ?? webrtc?.isSpeakerOn ?? true;
  const isSTTActive = propIsSTTActive ?? stt?.isSTTActive ?? false;
  const speakingUsers = propSpeakingUsers ?? webrtc?.speakingUsers ?? {};
  const userSubtitles = propUserSubtitles ?? stt?.userSubtitles ?? {};

  const handleToggleMic = propOnToggleMic || webrtc?.toggleMic;
  const handleToggleSpeaker = propOnToggleSpeaker || webrtc?.toggleSpeaker;
  const handleToggleSTT = propOnToggleSTT || stt?.toggleSTT;

  const turnPlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayerId);
  const outcomeWinnerIds = gameState.roundWinnerIds?.length
    ? gameState.roundWinnerIds
    : gameState.outcome?.winnerIds || [];
  const roundWinner = gameState.players.find(p => outcomeWinnerIds.includes(p.id));
  const matchWinner = gameState.players.find(p => p.id === gameState.matchWinnerId);
  const targetPlayer = opponents.find(p => p.id === selectedTargetId);

  const isPaused = propIsPaused ?? gameSocket.isPaused;
  const pausedPlayerName = propPausedPlayerName ?? gameSocket.pausedPlayerName ?? '플레이어';

  return (
    <BoardSurface onPointerDown={() => sfx.unlockAndStart()}>
      {/* 1. TOP HUD (Section 3 Tier 1) */}
      <GameHud
        roundNumber={gameState.roundNumber}
        myTokens={me?.tokens || 0}
        targetTokens={gameState.config.targetTokens}
        turnPlayerNickname={turnPlayer?.nickname || '플레이어'}
        isMyTurn={isMyTurn}
        isConnected={gameSocket.isConnected}
        isMicOn={isMicOn}
        isSpeakerOn={isSpeakerOn}
        isSTTActive={isSTTActive}
        onToggleMic={handleToggleMic}
        onToggleSpeaker={handleToggleSpeaker}
        onToggleSTT={handleToggleSTT}
        onOpenSettings={() => setMenuDrawerOpen(true)}
      />

      {/* Spatial Motion & VFX Stage */}
      <SpatialMotionStage
        currentAction={currentAction}
        phase={phase}
        myUserId={activeUserId}
        players={gameState.players}
      />

      {/* 2. OPPONENT RAIL (Section 3 Tier 2) */}
      <OpponentRail
        opponents={opponents}
        currentTurnPlayerId={gameState.currentTurnPlayerId}
        targetablePlayerIds={targetablePlayerIds}
        selectedTargetId={selectedTargetId}
        speakingUsers={speakingUsers}
        userSubtitles={userSubtitles}
        onSelectTarget={handleSelectTarget}
        onInspectDiscards={handleInspectDiscards}
      />

      {/* 3 & 4. ACTION STAGE & DECK INFO (Section 3 Tier 3 & 4) */}
      <ActionStage
        deckCount={(gameState as GameState & { deckCount?: number }).deckCount ?? gameState.deck.length}
        setAsideCount={(gameState as GameState & { setAsideCardCount?: number }).setAsideCardCount || 0}
        players={gameState.players}
        lastAction={gameSocket.lastAction || gameState.lastAction}
        presentationAction={currentAction}
        presentationPhase={phase}
        interactionState={interactionState}
        isOverDropZone={isOverDropZone}
        activeCard={selectedCard}
        targetPlayerName={targetPlayer?.nickname}
        onCancelAction={handleCancelAction}
        onSelectSelfTarget={() => handleSelectTarget(activeUserId)}
      />

      {/* My cards are played in front of me, not into the middle of the table. */}
      {me && (
        <MyPlayArea data-player-id={activeUserId}>
          <PlayerSeat
            player={me}
            isCurrentTurn={isMyTurn}
            isTargetable={targetablePlayerIds.includes(activeUserId)}
            isSelectedTarget={selectedTargetId === activeUserId}
            isSelf
            isSpeaking={!!speakingUsers[activeUserId]}
            subtitle={userSubtitles[activeUserId]}
            onClickTarget={() => handleSelectTarget(activeUserId)}
            onInspectDiscards={() => handleInspectDiscards(activeUserId)}
          />
        </MyPlayArea>
      )}
      <PlayerHand
        hand={myHand}
        isMyTurn={canInteract}
        selectedCardId={selectedCardId}
        interactionState={interactionState}
        onSelectCard={handleSelectCard}
        onValidDrop={handleSelectCard}
        onCancelSelection={handleCancelAction}
      />

      {/* Modals & Bottom Sheets */}
      <GuessSelector
        isOpen={isGuessOpen}
        targetPlayerName={targetPlayer?.nickname || '상대방'}
        remainingCounts={remainingCounts}
        onSelectGuess={handleConfirmGuess}
        onCancel={handleCancelAction}
      />

      <DiscardHistoryModal
        isOpen={!!inspectingPlayer}
        playerName={inspectingPlayer?.name || ''}
        discardPile={inspectingPlayer?.discards || []}
        onClose={() => setInspectingPlayer(null)}
      />

      <PriestSecretModal
        isOpen={!!priestSecret && gameState.matchState === 'PLAYING'}
        targetPlayerName={priestSecret?.targetName || ''}
        secretCard={priestSecret?.card || null}
        onClose={() => {
          setPriestSecret(null);
          gameSocket.clearPriestSecret();
        }}
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
    </BoardSurface>
  );
};

const BoardSurface = styled.div`
  position: relative;
  width: 100vw;
  height: 100dvh;
  max-height: 100dvh;
  background-color: ${THEME.background};
  background-image: ${THEME.gradients.marbleBase};
  display:grid;
  grid-template-rows:auto auto minmax(0, 1fr) auto auto;
  overflow: hidden;
  user-select: none;
  box-sizing: border-box;
  font-family: ${THEME.font.sans};
  color: ${THEME.foreground};
`;

const MyPlayArea = styled.div`
  width: min(240px, calc(100% - 16px));
  align-self: center;
  flex-shrink: 0;
  margin-top: 2px;
`;

export default LoveLetterGame;
