import React from 'react';
import styled from 'styled-components';
import { GameCard } from './GameCard';
import { CardInstance, CardValue } from '../../../../packages/love-letter-core/src/types';

interface PlayerHandProps {
  hand: CardInstance[];
  isMyTurn: boolean;
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onPlayCardDrag: (cardId: string) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  hand,
  isMyTurn,
  selectedCardId,
  onSelectCard,
  onPlayCardDrag,
  onDragStateChange,
}) => {
  const hasCountess = hand.some(c => c.value === 7);
  const hasPrinceOrKing = hand.some(c => c.value === 5 || c.value === 6);

  return (
    <HandContainer>
      {isMyTurn && (
        <DragGuidanceRibbon>
          ✨ 카드를 위로 끌어올리거나 탭하여 사용하세요
        </DragGuidanceRibbon>
      )}

      <CardsRow>
        {hand.map((card, idx) => {
          const isSelected = selectedCardId === card.id;
          const isCountessLocked = hasCountess && hasPrinceOrKing && card.value !== 7;

          return (
            <GameCard
              key={card.id || `hand_${idx}`}
              id={card.id}
              value={card.value as CardValue}
              name={card.name}
              isSelected={isSelected}
              isDisabled={!isMyTurn || isCountessLocked}
              disabledReason={isCountessLocked ? '백작부인 필수 사용' : undefined}
              enableDrag={isMyTurn && !isCountessLocked}
              onClick={() => isMyTurn && !isCountessLocked && onSelectCard(card.id)}
              onDragEnd={(_, info) => {
                if (onDragStateChange) onDragStateChange(false);
                if (info.offset.y < -50 && isMyTurn && !isCountessLocked) {
                  onPlayCardDrag(card.id);
                }
              }}
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
  padding-bottom: 12px;
  gap: 8px;
`;

const DragGuidanceRibbon = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: #d4af37;
  background: rgba(24, 24, 27, 0.8);
  border: 1px solid rgba(212, 175, 55, 0.3);
  padding: 3px 12px;
  border-radius: 12px;
  letter-spacing: 0.2px;
`;

const CardsRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 16px;
`;
