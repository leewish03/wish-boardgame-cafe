import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { CardValue } from '../../../../packages/love-letter-core/src/types';
import { THEME } from '../../../shared/theme';
import { getHeraldicIcon } from '../presentation/heraldicIcons';

interface GuessSelectorProps {
  isOpen: boolean;
  targetPlayerName: string;
  remainingCounts: Record<number, { remaining: number; total: number }>;
  onSelectGuess: (value: CardValue) => void;
  onCancel: () => void;
}

export const GuessSelector: React.FC<GuessSelectorProps> = ({
  isOpen,
  targetPlayerName,
  remainingCounts,
  onSelectGuess,
  onCancel,
}) => {
  const guessValues: CardValue[] = [2, 3, 4, 5, 6, 7, 8];

  return (
    <AnimatePresence>
      {isOpen && (
        <Overlay
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <SheetContainer
            as={motion.div}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={e => e.stopPropagation()}
          >
            <HeaderRow>
              <TitleCluster>
                <TargetIcon>🎯</TargetIcon>
                <SheetTitle>
                  <strong>[{targetPlayerName}]</strong> 님의 카드 번호 추측
                </SheetTitle>
              </TitleCluster>
              <CloseButton onClick={onCancel}>✕</CloseButton>
            </HeaderRow>

            <HelperNotice>
              경비병(1)을 제외한 2~8번 카드를 지목하세요. 적중 시 상대는 즉시 탈락합니다.
            </HelperNotice>

            <ChipGrid>
              {guessValues.map(v => {
                const meta = CARD_DEFINITIONS[v];
                const count = remainingCounts[v] || { remaining: meta.count, total: meta.count };
                const isZero = count.remaining === 0;

                return (
                  <GuessChip
                    key={v}
                    as={motion.button}
                    whileHover={!isZero ? { scale: 1.03 } : undefined}
                    whileTap={!isZero ? { scale: 0.95 } : undefined}
                    $isZero={isZero}
                    disabled={isZero}
                    onClick={() => onSelectGuess(v)}
                  >
                    <ChipHeader>
                      <ChipVal>{v}</ChipVal>
                      <EmblemMini>{getHeraldicIcon(v, 16)}</EmblemMini>
                    </ChipHeader>
                    <ChipName>{meta.name}</ChipName>
                    <ChipCount $isZero={isZero}>
                      잔여 {count.remaining}/{count.total}
                    </ChipCount>
                  </GuessChip>
                );
              })}
            </ChipGrid>
          </SheetContainer>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(9, 13, 22, 0.65);
  backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
`;

const SheetContainer = styled.div`
  width: 100%;
  max-width: 480px;
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleSlab};
  border-top: 2px solid ${THEME.gold};
  border-radius: 20px 20px 0 0;
  padding: 16px 18px 24px;
  box-shadow: 0 -8px 32px rgba(9, 13, 22, 0.3);
  box-sizing: border-box;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`;

const TitleCluster = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TargetIcon = styled.span`
  font-size: 16px;
`;

const SheetTitle = styled.h3`
  margin: 0;
  font-size: 13.5px;
  font-weight: 800;
  color: ${THEME.foreground};

  strong {
    color: ${THEME.burgundy};
  }
`;

const CloseButton = styled.button`
  background: #f1f5f9;
  border: 1px solid ${THEME.border};
  color: ${THEME.mutedForeground};
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;

  &:hover {
    background: #e2e8f0;
    color: ${THEME.foreground};
  }
`;

const HelperNotice = styled.p`
  margin: 0 0 12px;
  font-size: 11px;
  color: ${THEME.mutedForeground};
  line-height: 1.4;
`;

const ChipGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;

  @media (max-width: 400px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
`;

const GuessChip = styled.button<{ $isZero: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  background: ${props => (props.$isZero ? '#f1f5f9' : '#ffffff')};
  border: 1.5px solid ${props => (props.$isZero ? '#e2e8f0' : THEME.gold)};
  border-radius: ${THEME.radius.lg};
  box-shadow: ${props => (props.$isZero ? 'none' : '0 2px 8px rgba(9, 13, 22, 0.06)')};
  cursor: ${props => (props.$isZero ? 'not-allowed' : 'pointer')};
  opacity: ${props => (props.$isZero ? 0.45 : 1)};
  transition: all 0.15s ease;

  &:hover {
    ${props =>
      !props.$isZero &&
      `
      background: linear-gradient(135deg, #ffffff 0%, #fefce8 100%);
      box-shadow: 0 4px 12px rgba(197, 160, 89, 0.3);
    `}
  }
`;

const ChipHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
`;

const ChipVal = styled.span`
  font-family: ${THEME.font.serif};
  font-size: 14px;
  font-weight: 900;
  color: ${THEME.primary};
`;

const EmblemMini = styled.span`
  line-height: 1;
`;

const ChipName = styled.span`
  font-size: 11px;
  font-weight: 800;
  color: ${THEME.foreground};
  margin-bottom: 2px;
`;

const ChipCount = styled.span<{ $isZero: boolean }>`
  font-size: 9.5px;
  font-weight: 700;
  color: ${props => (props.$isZero ? THEME.destructive : THEME.mutedForeground)};
`;
