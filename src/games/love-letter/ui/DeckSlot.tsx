import React from 'react';
import styled from 'styled-components';
import { THEME } from '../../../shared/theme';

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
            <TopDeckCard>
              <DeckPattern>W</DeckPattern>
              <DeckCountBadge>{count}</DeckCountBadge>
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
  flex-shrink: 0;
`;

const DeckStack = styled.div`
  position: relative;
  width: 48px;
  height: 70px;
`;

const BackCardLayer = styled.div<{ $offset: number }>`
  position: absolute;
  top: ${props => props.$offset}px;
  left: ${props => props.$offset}px;
  width: 100%;
  height: 100%;
  background: ${THEME.burgundyDeep};
  border: 1px solid ${THEME.goldAntique};
  border-radius: ${THEME.radius.md};
  box-shadow: 0 2px 6px rgba(9, 13, 22, 0.2);
`;

const TopDeckCard = styled.div`
  position: absolute;
  inset: 0;
  background: ${THEME.gradients.burgundySeal};
  border: 1.5px solid ${THEME.gold};
  border-radius: ${THEME.radius.md};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(9, 13, 22, 0.25), inset 0 0 0 1px rgba(255, 255, 255, 0.15);
  cursor: default;
`;

const DeckPattern = styled.div`
  font-family: ${THEME.font.serif};
  font-size: 17px;
  font-weight: 900;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
`;

const DeckCountBadge = styled.span`
  font-size: 14px;
  font-weight: 800;
  font-family: ${THEME.font.serif};
  color: ${THEME.goldLight};
  margin-top: 0;
  letter-spacing: 0.04em;
`;

const EmptyDeckSlot = styled.div`
  width: 100%;
  height: 100%;
  border: 1.5px dashed ${THEME.border};
  border-radius: ${THEME.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9.5px;
  font-weight: 700;
  color: ${THEME.mutedForeground};
  background: rgba(241, 245, 249, 0.6);
`;
