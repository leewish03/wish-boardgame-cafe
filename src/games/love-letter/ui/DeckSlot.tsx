import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

interface DeckSlotProps {
  count: number;
  setAsideCard?: any;
}

export const DeckSlot: React.FC<DeckSlotProps> = ({ count, setAsideCard }) => {
  return (
    <DeckWrapper>
      <DeckStack id="deck-slot">
        {count > 0 ? (
          <>
            <BackCardLayer $offset={4} />
            <BackCardLayer $offset={2} />
            <TopDeckCard as={motion.div} whileHover={{ y: -2 }}>
              <DeckPattern>💌</DeckPattern>
              <DeckCountBadge>{count}장</DeckCountBadge>
            </TopDeckCard>
          </>
        ) : (
          <EmptyDeckSlot>덱 소진</EmptyDeckSlot>
        )}
      </DeckStack>
    </DeckWrapper>
  );
};

const DeckWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const DeckStack = styled.div`
  position: relative;
  width: 58px;
  height: 84px;
`;

const BackCardLayer = styled.div<{ $offset: number }>`
  position: absolute;
  top: ${props => props.$offset}px;
  left: ${props => props.$offset}px;
  width: 100%;
  height: 100%;
  background: #831843;
  border: 1px solid #d4af37;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
`;

const TopDeckCard = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 40%, #9d174d 0%, #500724 100%);
  border: 1.5px solid #d4af37;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  cursor: default;
`;

const DeckPattern = styled.div`
  font-size: 20px;
`;

const DeckCountBadge = styled.span`
  font-size: 10px;
  font-weight: 700;
  color: #fef08a;
  margin-top: 2px;
`;

const EmptyDeckSlot = styled.div`
  width: 100%;
  height: 100%;
  border: 1.5px dashed rgba(212, 175, 55, 0.4);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #a1a1aa;
`;
