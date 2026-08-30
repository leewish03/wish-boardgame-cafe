import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

interface RoundResultModalProps {
  isOpen: boolean;
  roundNumber: number;
  winnerName: string;
  isHost: boolean;
  onNextRound: () => void;
}

export const RoundResultModal: React.FC<RoundResultModalProps> = ({
  isOpen,
  roundNumber,
  winnerName,
  isHost,
  onNextRound,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <Overlay
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ResultCard
            as={motion.div}
            initial={{ scale: 0.7, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.7, y: 30 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          >
            <WaxSealStamp>💌</WaxSealStamp>
            <RoundBadge>ROUND {roundNumber} WINNER</RoundBadge>
            <WinnerName>👑 {winnerName}</WinnerName>
            <TokenAwarded>호감도 토큰(♥) 1개 획득!</TokenAwarded>

            {isHost && (
              <NextRoundBtn onClick={onNextRound}>
                다음 라운드 시작하기 ➔
              </NextRoundBtn>
            )}
          </ResultCard>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const ResultCard = styled.div`
  width: 100%;
  max-width: 360px;
  background: #18181b;
  border: 2px solid #d4af37;
  border-radius: 16px;
  padding: 28px 20px;
  text-align: center;
  box-shadow: 0 0 40px rgba(212, 175, 55, 0.4);
`;

const WaxSealStamp = styled.div`
  font-size: 48px;
  margin-bottom: 8px;
  filter: drop-shadow(0 4px 12px rgba(225, 29, 72, 0.5));
`;

const RoundBadge = styled.span`
  font-size: 11px;
  font-weight: 700;
  color: #d4af37;
  letter-spacing: 1px;
  text-transform: uppercase;
`;

const WinnerName = styled.h2`
  margin: 6px 0;
  font-size: 20px;
  font-weight: 800;
  color: #fef08a;
`;

const TokenAwarded = styled.p`
  margin: 0 0 20px;
  font-size: 13px;
  color: #f43f5e;
  font-weight: 600;
`;

const NextRoundBtn = styled.button`
  width: 100%;
  padding: 12px;
  background: #d4af37;
  color: #18181b;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
`;
