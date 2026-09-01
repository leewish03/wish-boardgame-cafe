import React from 'react';
import styled from 'styled-components';
import { THEME } from '../../../shared/theme';
import { useTableAnchor } from '../presentation/TableAnchorRegistry';

interface DeckSlotProps {
  count: number;
  setAsideCount?: number;
}

export const DeckSlot: React.FC<DeckSlotProps> = ({ count, setAsideCount = 0 }) => {
  const deckAnchor = useTableAnchor('deck', 'deck');
  const asideAnchor = useTableAnchor('deck', 'aside');
  return (
    <DeckWrapper>
      <DeckStack ref={deckAnchor} id="deck-slot">
        {count > 0 ? (
          <>
            <BackCardLayer $offset={4} />
            <BackCardLayer $offset={2} />
            <TopDeckCard>
              <DeckCountBadge>{count}</DeckCountBadge>
            </TopDeckCard>
          </>
        ) : (
          <EmptyDeckSlot>덱 소진</EmptyDeckSlot>
        )}
      </DeckStack>
      {setAsideCount > 0 && <AsideStack ref={asideAnchor} aria-label={`이번 라운드 제외 카드 ${setAsideCount}장`}><AsideCard /><AsideLabel>제외 {setAsideCount}</AsideLabel></AsideStack>}
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
  @media(max-width:360px), (max-height:650px){width:40px;height:58px;}
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

const DeckCountBadge = styled.span`
  font-size: 14px;
  font-weight: 800;
  font-family: ${THEME.font.serif};
  color: ${THEME.goldLight};
  margin-top: 0;
  letter-spacing: 0.04em;
`;

const AsideStack = styled.div`display:flex; flex-direction:column; align-items:center; gap:3px; margin-left:8px; @media(max-width:360px), (max-height:650px){margin-left:5px;}`;
const AsideCard = styled.div`width:24px; height:36px; border-radius:5px; background:${THEME.burgundyDeep}; border:1px solid ${THEME.goldAntique}; box-shadow:2px 2px 0 rgba(9,13,22,.16); @media(max-width:360px), (max-height:650px){width:19px;height:29px;}`;
const AsideLabel = styled.span`font-size:8px; color:${THEME.mutedForeground}; font-weight:800; white-space:nowrap;`;

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
