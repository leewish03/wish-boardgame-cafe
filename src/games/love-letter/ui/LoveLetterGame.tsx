import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { GameHud } from './GameHud';
import { OpponentRail } from './OpponentRail';
import { ActionStage } from './ActionStage';
import { PlayerHand } from './PlayerHand';
import { GuessSelector } from './GuessSelector';
import { GameState, CardValue, PlayerId } from '../../../../packages/love-letter-core/src/types';
import { calculateRemainingCards } from '../../../../packages/love-letter-core/src/selectors';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';

interface LoveLetterGameProps {
  gameState: GameState;
  myUserId: string;
  myHand: any[];
  onPlayCard: (cardId: string, targetId?: string, guessValue?: number) => void;
  onLeaveRoom: () => void;
}

export const LoveLetterGame: React.FC<LoveLetterGameProps> = ({
  gameState,
  myUserId,
  myHand,
  onPlayCard,
  onLeaveRoom,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isGuessOpen, setIsGuessOpen] = useState(false);

  const me = gameState.players.find(p => p.id === myUserId);
  const opponents = gameState.players.filter(p => p.id !== myUserId);
  const isMyTurn = gameState.currentTurnPlayerId === myUserId && !me?.isEliminated;

  const selectedCard = useMemo(() => {
    return myHand.find(c => c.id === selectedCardId);
  }, [myHand, selectedCardId]);

  // Targetable player ids
  const targetablePlayerIds = useMemo(() => {
    if (!isMyTurn || !selectedCard) return [];
    const meta = CARD_DEFINITIONS[selectedCard.value as CardValue];
    if (!meta.needsTarget) return [];

    return opponents
      .filter(p => !p.isEliminated && !p.isProtected)
      .map(p => p.id);
  }, [isMyTurn, selectedCard, opponents]);

  // Remaining cards for Guard helper
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

    const meta = CARD_DEFINITIONS[card.value as CardValue];
    // If card doesn't need target (Handmaid, Countess, Princess), execute immediately
    if (!meta.needsTarget) {
      onPlayCard(cardId);
      setSelectedCardId(null);
    }
  };

  const handleSelectTarget = (targetId: PlayerId) => {
    if (!selectedCardId || !selectedCard) return;

    setSelectedTargetId(targetId);

    // If Guard (1), open Guess Selector
    if (selectedCard.value === 1) {
      setIsGuessOpen(true);
    } else {
      // Execute targeted card (Priest, Baron, Prince, King)
      onPlayCard(selectedCardId, targetId);
      setSelectedCardId(null);
      setSelectedTargetId(null);
    }
  };

  const handleConfirmGuess = (guessVal: CardValue) => {
    if (!selectedCardId || !selectedTargetId) return;
    onPlayCard(selectedCardId, selectedTargetId, guessVal);
    setIsGuessOpen(false);
    setSelectedCardId(null);
    setSelectedTargetId(null);
  };

  const turnPlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayerId);

  return (
    <BoardSurface>
      <GameHud
        roundNumber={gameState.roundNumber}
        myTokens={me?.tokens || 0}
        targetTokens={gameState.config.targetTokens}
        turnPlayerNickname={turnPlayer?.nickname || '플레이어'}
        isMyTurn={isMyTurn}
        onOpenSettings={onLeaveRoom}
      />

      <OpponentRail
        opponents={opponents}
        currentTurnPlayerId={gameState.currentTurnPlayerId}
        targetablePlayerIds={targetablePlayerIds}
        selectedTargetId={selectedTargetId}
        onSelectTarget={handleSelectTarget}
      />

      <ActionStage
        deckCount={gameState.deck.length}
        lastAction={gameState.lastAction}
        isDraggingCard={false}
      />

      <PlayerHand
        hand={myHand}
        isMyTurn={isMyTurn}
        selectedCardId={selectedCardId}
        onSelectCard={handleSelectCard}
        onPlayCardDrag={handleSelectCard}
      />

      <GuessSelector
        isOpen={isGuessOpen}
        targetPlayerName={opponents.find(p => p.id === selectedTargetId)?.nickname || '상대방'}
        remainingCounts={remainingCounts}
        onSelectGuess={handleConfirmGuess}
        onCancel={() => setIsGuessOpen(false)}
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
