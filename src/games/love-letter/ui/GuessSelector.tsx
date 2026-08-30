import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { CardValue } from '../../../../packages/love-letter-core/src/types';

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
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={e => e.stopPropagation()}
          >
            <HeaderRow>
              <SheetTitle>🎯 [{targetPlayerName}] 님의 카드를 추측하세요</SheetTitle>
              <CloseButton onClick={onCancel}>✕</CloseButton>
            </HeaderRow>

            <ChipGrid>
              {guessValues.map(v => {
                const meta = CARD_DEFINITIONS[v];
                const count = remainingCounts[v] || { remaining: meta.count, total: meta.count };
                const isZero = count.remaining === 0;

                return (
                  <GuessChip
                    key={v}
                    as={motion.button}
                    whileTap={!isZero ? { scale: 0.95 } : undefined}
                    $isZero={isZero}
                    disabled={isZero}
                    onClick={() => onSelectGuess(v)}
                  >
                    <ChipVal>{v}</ChipVal>
                    <ChipName>{meta.name}</ChipName>
                    <ChipCount>({count.remaining}/{count.total})</ChipCount>
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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
`;

const SheetContainer = styled.div`
  width: 100%;
  max-width: 480px;
  background: #18181b;
  border-top: 2px solid #d4af37;
  border-radius: 16px 16px 0 0;
  padding: 16px 20px 24px;
  box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
`;

const SheetTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #fef08a;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: #a1a1aa;
  font-size: 16px;
  cursor: pointer;
`;

const ChipGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;

  @media (max-width: 420px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const GuessChip = styled.button<{ $isZero: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  background: ${props => props.$isZero ? '#27272a' : 'linear-gradient(180deg, #27272a 0%, #1c1917 100%)'};
  border: 1px solid ${props => props.$isZero ? '#3f3f46' : 'rgba(212, 175, 55, 0.4)'};
  border-radius: 8px;
  color: ${props => props.$isZero ? '#71717a' : '#f4f4f5'};
  cursor: ${props => props.$isZero ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.$isZero ? 0.4 : 1};
`;

const ChipVal = styled.span`
  font-size: 14px;
  font-weight: 800;
  color: #d4af37;
`;

const ChipName = styled.span`
  font-size: 11px;
  font-weight: 600;
  margin-top: 2px;
`;

const ChipCount = styled.span`
  font-size: 9px;
  color: #a1a1aa;
  margin-top: 2px;
`;
