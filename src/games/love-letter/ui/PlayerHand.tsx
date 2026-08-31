import React, { useCallback } from 'react';
import styled from 'styled-components';
import { PanInfo } from 'framer-motion';
import { GameCard } from './GameCard';
import { CardInstance, CardValue } from '../../../../packages/love-letter-core/src/types';

interface PlayerHandProps {
  hand: CardInstance[];
  isMyTurn: boolean;
  selectedCardId: string | null;
  interactionState: string;
  errorMessage?: string | null;
  onSelectCard: (card: CardInstance) => void;
  onValidDrop: (card: CardInstance) => void;
  onDragStateChange?: (isDragging: boolean, isOverDropZone: boolean) => void;
  onCancelSelection?: () => void;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  hand,
  isMyTurn,
  selectedCardId,
  interactionState,
  errorMessage,
  onSelectCard,
  onValidDrop,
  onDragStateChange,
  onCancelSelection,
}) => {
  // Section 36: Countess Rule (Holding Countess 7 + Prince 5 / King 6)
  const hasCountess = hand.some(c => c.value === 7);
  const hasPrinceOrKing = hand.some(c => c.value === 5 || c.value === 6);

  const checkDropZoneCollision = useCallback((point: { x: number; y: number }) => {
    const dropZoneEl = document.getElementById('action-stage-drop-zone');
    if (!dropZoneEl) return false;
    const rect = dropZoneEl.getBoundingClientRect();
    // Generous bounding box (+12px threshold) for smooth mobile touch interaction
    return (
      point.x >= rect.left - 12 &&
      point.x <= rect.right + 12 &&
      point.y >= rect.top - 12 &&
      point.y <= rect.bottom + 12
    );
  }, []);

  const handleDragStart = useCallback(() => {
    if (onDragStateChange) {
      onDragStateChange(true, false);
    }
  }, [onDragStateChange]);

  const handleDrag = useCallback((_: any, info: PanInfo) => {
    if (onDragStateChange) {
      const isOver = checkDropZoneCollision(info.point);
      onDragStateChange(true, isOver);
    }
  }, [checkDropZoneCollision, onDragStateChange]);

  const handleDragEnd = useCallback((card: CardInstance, _: any, info: PanInfo) => {
    const isOver = checkDropZoneCollision(info.point);
    if (onDragStateChange) {
      onDragStateChange(false, false);
    }

    if (isOver && isMyTurn) {
      onValidDrop(card);
    }
  }, [checkDropZoneCollision, isMyTurn, onDragStateChange, onValidDrop]);

  return (
    <HandContainer>
      {/* Dynamic Turn & Action Guidance Ribbon */}
      {errorMessage ? (
        <ErrorRibbon>❌ {errorMessage}</ErrorRibbon>
      ) : isMyTurn ? (
        <GuidanceRibbon>
          {interactionState === 'TARGETING'
            ? '🎯 플레이어 자리를 터치해 대상을 지목하세요'
            : interactionState === 'GUESSING'
            ? '🔮 추측할 카드 번호를 선택하세요'
            : interactionState === 'SUBMITTING'
            ? '⏳ 카드를 제출하는 중입니다...'
            : '✨ 카드를 위로 끌어올리거나 탭하여 사용하세요'}
        </GuidanceRibbon>
      ) : null}

      <CardsRow>
        {hand.map((card, idx) => {
          const isSelected = selectedCardId === card.id;
          const isCountessLocked = hasCountess && hasPrinceOrKing && card.value !== 7;
          const isLockedOut = !isMyTurn || isCountessLocked || interactionState === 'SUBMITTING';

          return (
            <GameCard
              key={card.id || `hand_${idx}`}
              id={card.id}
              value={card.value as CardValue}
              name={card.name}
              isSelected={isSelected}
              isDisabled={isLockedOut}
              disabledReason={isCountessLocked ? '백작부인을 먼저 사용해야 합니다' : undefined}
              enableDrag={isMyTurn && !isCountessLocked && interactionState === 'IDLE'}
              onClick={() => {
                if (!isLockedOut) {
                  onSelectCard(card);
                }
              }}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={(_, info) => handleDragEnd(card, _, info)}
            />
          );
        })}
      </CardsRow>
    </HandContainer>
  );
};

const HandContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding-bottom: 8px;
  gap: 6px;
  box-sizing: border-box;
  flex-shrink: 0;
`;

const GuidanceRibbon = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #d4af37;
  background: rgba(24, 24, 27, 0.88);
  border: 1px solid rgba(212, 175, 55, 0.35);
  padding: 3px 12px;
  border-radius: 12px;
  letter-spacing: 0.1px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
`;

const ErrorRibbon = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #fca5a5;
  background: rgba(127, 29, 29, 0.9);
  border: 1px solid #ef4444;
  padding: 3px 12px;
  border-radius: 12px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
`;

const CardsRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
  width: 100%;
  max-width: 360px;
`;
