import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { GameHud } from './GameHud';
import { OpponentRail } from './OpponentRail';
import { ActionStage } from './ActionStage';
import { PlayerHand } from './PlayerHand';
import { GuessSelector } from './GuessSelector';
import { DiscardHistoryModal } from './DiscardHistoryModal';
import { PriestSecretModal } from './PriestSecretModal';
import { RoundResultModal } from './RoundResultModal';
import { MatchResultModal } from './MatchResultModal';
import { PauseOverlay } from './PauseOverlay';
import { SpatialMotionStage } from '../presentation/SpatialMotionStage';
import { useActionTimeline } from '../presentation/useActionTimeline';
import { sfx } from '../../../shared/sfx';
import { GameState, CardValue, PlayerId, CardInstance } from '../../../../packages/love-letter-core/src/types';
import { calculateRemainingCards } from '../../../../packages/love-letter-core/src/selectors';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';

interface LoveLetterGameProps {
  gameState: GameState;
  myUserId: string;
  myHand: any[];
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
  onPlayCard: (cardId: string, targetId?: string, guessValue?: number) => void;
  onStartNextRound?: () => void;
  onForfeit?: () => void;
  onLeaveRoom: () => void;
}

export const LoveLetterGame: React.FC<LoveLetterGameProps> = ({
  gameState,
  myUserId,
  myHand,
  speakingUsers = {},
  userSubtitles = {},
  isMicOn,
  isSpeakerOn,
  isSTTActive,
  isPaused = false,
  pausedPlayerName,
  onToggleMic,
  onToggleSpeaker,
  onToggleSTT,
  onPlayCard,
  onStartNextRound,
  onForfeit,
  onLeaveRoom,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isGuessOpen, setIsGuessOpen] = useState(false);
  const [isDraggingCard, setIsDraggingCard] = useState(false);

  // Modals state
  const [inspectingPlayer, setInspectingPlayer] = useState<{ name: string; discards: CardInstance[] } | null>(null);
  const [priestSecret, setPriestSecret] = useState<{ targetName: string; card: CardInstance } | null>(null);

  const { currentAction } = useActionTimeline();

  const me = gameState.players.find(p => p.id === myUserId);
  const opponents = gameState.players.filter(p => p.id !== myUserId);
  const isMyTurn = gameState.currentTurnPlayerId === myUserId && !me?.isEliminated;

  // Sound effects on state transitions
  useEffect(() => {
    if (isMyTurn) {
      sfx.playTurnAlert();
    }
  }, [isMyTurn]);

  useEffect(() => {
    if (gameState.matchState === 'ROUND_END') {
      sfx.playRoundWin();
    } else if (gameState.matchState === 'GAME_OVER') {
      sfx.playMatchWin();
    }
  }, [gameState.matchState]);

  const selectedCard = useMemo(() => {
    return myHand.find(c => c.id === selectedCardId);
  }, [myHand, selectedCardId]);

  const targetablePlayerIds = useMemo(() => {
    if (!isMyTurn || !selectedCard) return [];
    const meta = CARD_DEFINITIONS[selectedCard.value as CardValue];
    if (!meta.needsTarget) return [];

    return opponents
      .filter(p => !p.isEliminated && !p.isProtected)
      .map(p => p.id);
  }, [isMyTurn, selectedCard, opponents]);

  const allDiscards = useMemo(() => {
    return gameState.players.flatMap(p => p.discardPile || []);
  }, [gameState.players]);

  const remainingCounts = useMemo(() => {
    return calculateRemainingCards(allDiscards, myHand);
  }, [allDiscards, myHand]);

  const handleSelectCard = (cardId: string) => {
    const card = myHand.find(c => c.id === cardId);
    if (!card) return;

    setSelectedCardId(cardId);
    setSelectedTargetId(null);
    sfx.playCardDeal();

    const meta = CARD_DEFINITIONS[card.value as CardValue];
    if (!meta.needsTarget) {
      onPlayCard(cardId);
      setSelectedCardId(null);
      sfx.playCardPlay();
    }
  };

  const handleSelectTarget = (targetId: PlayerId) => {
    if (!selectedCardId || !selectedCard) return;

    setSelectedTargetId(targetId);

    if (selectedCard.value === 1) {
      setIsGuessOpen(true);
    } else {
      onPlayCard(selectedCardId, targetId);
      setSelectedCardId(null);
      setSelectedTargetId(null);
      sfx.playCardPlay();
    }
  };

  const handleConfirmGuess = (guessVal: CardValue) => {
    if (!selectedCardId || !selectedTargetId) return;
    onPlayCard(selectedCardId, selectedTargetId, guessVal);
    setIsGuessOpen(false);
    setSelectedCardId(null);
    setSelectedTargetId(null);
    sfx.playCardPlay();
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

  const turnPlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayerId);
  const roundWinner = gameState.players.find(p => p.id === gameState.roundWinnerId);
  const matchWinner = gameState.players.find(p => p.id === gameState.matchWinnerId);

  return (
    <BoardSurface>
      <GameHud
        roundNumber={gameState.roundNumber}
        myTokens={me?.tokens || 0}
        targetTokens={gameState.config.targetTokens}
        turnPlayerNickname={turnPlayer?.nickname || '플레이어'}
        isMyTurn={isMyTurn}
        isMicOn={isMicOn}
        isSpeakerOn={isSpeakerOn}
        isSTTActive={isSTTActive}
        onToggleMic={onToggleMic}
        onToggleSpeaker={onToggleSpeaker}
        onToggleSTT={onToggleSTT}
        onOpenSettings={onLeaveRoom}
      />

      <SpatialMotionStage currentAction={currentAction} />

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

      <ActionStage
        deckCount={gameState.deck.length}
        lastAction={gameState.lastAction}
        isDraggingCard={isDraggingCard}
      />

      <PlayerHand
        hand={myHand}
        isMyTurn={isMyTurn}
        selectedCardId={selectedCardId}
        onSelectCard={handleSelectCard}
        onPlayCardDrag={handleSelectCard}
      />

      {/* Modals & Dialogs */}
      <GuessSelector
        isOpen={isGuessOpen}
        targetPlayerName={opponents.find(p => p.id === selectedTargetId)?.nickname || '상대방'}
        remainingCounts={remainingCounts}
        onSelectGuess={handleConfirmGuess}
        onCancel={() => setIsGuessOpen(false)}
      />

      <DiscardHistoryModal
        isOpen={!!inspectingPlayer}
        playerName={inspectingPlayer?.name || ''}
        discardPile={inspectingPlayer?.discards || []}
        onClose={() => setInspectingPlayer(null)}
      />

      <PriestSecretModal
        isOpen={!!priestSecret}
        targetPlayerName={priestSecret?.targetName || ''}
        secretCard={priestSecret?.card || null}
        onClose={() => setPriestSecret(null)}
      />

      <RoundResultModal
        isOpen={gameState.matchState === 'ROUND_END'}
        roundNumber={gameState.roundNumber}
        winnerName={roundWinner?.nickname || '승자'}
        isHost={me?.isHost || false}
        onNextRound={() => onStartNextRound && onStartNextRound()}
      />

      <MatchResultModal
        isOpen={gameState.matchState === 'GAME_OVER'}
        championName={matchWinner?.nickname || '우승자'}
        onReturnToLobby={onLeaveRoom}
      />

      <PauseOverlay
        isPaused={isPaused}
        pausedPlayerName={pausedPlayerName}
        onForfeit={() => onForfeit && onForfeit()}
      />
    </BoardSurface>
  );
};

const BoardSurface = styled.div`
  position: relative;
  width: 100vw;
  height: 100dvh;
  max-height: 100dvh;
  background: radial-gradient(circle at 50% 50%, #f7f4ed 0%, #e5e0d8 100%);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  user-select: none;
`;
