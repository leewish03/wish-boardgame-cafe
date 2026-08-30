import React from 'react';
import styled, { css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { DeckSlot } from './DeckSlot';
import { GameCard } from './GameCard';
import { GameEventSummary } from '../../../../packages/love-letter-core/src/types';

interface ActionStageProps {
  deckCount: number;
  lastAction: GameEventSummary | null;
  isDraggingCard: boolean;
  onDropCard?: () => void;
}

export const ActionStage: React.FC<ActionStageProps> = ({
  deckCount,
  lastAction,
  isDraggingCard,
  onDropCard,
}) => {
  return (
    <StageContainer>
      <DeckSlot count={deckCount} />

      {/* Central Action Arena / Drop Zone */}
      <ArenaSlot $isDropActive={isDraggingCard}>
        <AnimatePresence mode="wait">
          {lastAction && lastAction.card ? (
            <ActionCardWrapper
              key={lastAction.actionId}
              as={motion.div}
              initial={{ scale: 0.5, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              <GameCard
                value={lastAction.card.value}
                name={lastAction.card.name}
                compact
              />
              <ActionSummaryBadge>{lastAction.description}</ActionSummaryBadge>
            </ActionCardWrapper>
          ) : (
            <ArenaPlaceholder>
              {isDraggingCard ? '✨ 여기에 카드를 놓으세요' : '카드를 위로 끌어 사용'}
            </ArenaPlaceholder>
          )}
        </AnimatePresence>
      </ArenaSlot>
    </StageContainer>
  );
};

const StageContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  width: 100%;
  height: 120px;
  padding: 6px 16px;
`;

const ArenaSlot = styled.div<{ $isDropActive: boolean }>`
  position: relative;
  width: 160px;
  height: 108px;
  border-radius: 12px;
  border: 1.5px dashed rgba(212, 175, 55, 0.3);
  background: rgba(24, 24, 27, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  ${props => props.$isDropActive && css`
    border-color: #d4af37;
    background: rgba(212, 175, 55, 0.15);
    box-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
  `}
`;

const ArenaPlaceholder = styled.span`
  font-size: 11px;
  color: #a1a1aa;
  text-align: center;
  padding: 8px;
`;

const ActionCardWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const ActionSummaryBadge = styled.div`
  font-size: 10px;
  font-weight: 600;
  color: #fef08a;
  background: rgba(0, 0, 0, 0.75);
  padding: 2px 8px;
  border-radius: 8px;
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
`;
