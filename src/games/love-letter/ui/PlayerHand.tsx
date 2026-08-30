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
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  hand,
  isMyTurn,
  selectedCardId,
  onSelectCard,
  onPlayCardDrag,
}) => {
  // Countess rule validation
  const hasCountess = hand.some(c => c.value === 7);
  const hasPrinceOrKing = hand.some(c => c.value === 5 || c.value === 6);

  return (
    <HandContainer>
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
              disabledReason={isCountessLocked ? '백작부인 필수' : undefined}
              enableDrag={isMyTurn && !isCountessLocked}
              onClick={() => isMyTurn && !isCountessLocked && onSelectCard(card.id)}
              onDragEnd={(_, info) => {
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
`;

const CardsRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 16px;
`;
