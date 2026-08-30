import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

interface RoundResultModalProps {
  isOpen: boolean;
  roundNumber: number;
  winnerName: string;
  winnerReason?: string;
  winnerTokens?: number;
  targetTokens?: number;
  isHost: boolean;
  onNextRound: () => void;
}

export const RoundResultModal: React.FC<RoundResultModalProps> = ({
  isOpen,
  roundNumber,
  winnerName,
  winnerReason = '마지막 생존자 승리!',
  winnerTokens = 1,
  targetTokens = 4,
  isHost,
  onNextRound,
}) => {
  // Wax seal stamps generator
  const renderTokens = () => {
    const tokens = [];
    for (let i = 0; i < targetTokens; i++) {
      tokens.push(
        <HeartStamp key={i} $active={i < winnerTokens}>
          {i < winnerTokens ? '♥' : '○'}
        </HeartStamp>
      );
    }
    return tokens;
  };

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
            <WinnerReasonText>{winnerReason}</WinnerReasonText>

            <TokenStampContainer>
              <TokenLabel>호감도 획득 현황 ({winnerTokens}/{targetTokens}):</TokenLabel>
              <StampRow>{renderTokens()}</StampRow>
            </TokenStampContainer>

            {isHost ? (
              <NextRoundBtn onClick={onNextRound}>
                다음 라운드 시작하기 ➔
              </NextRoundBtn>
            ) : (
              <WaitingNotice>
                방장이 다음 라운드를 시작하거나 자동 진행 대기 중입니다...
              </WaitingNotice>
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
  padding: 24px 20px;
  text-align: center;
  box-shadow: 0 0 40px rgba(212, 175, 55, 0.4);
`;

const WaxSealStamp = styled.div`
  font-size: 44px;
  margin-bottom: 6px;
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
  margin: 6px 0 2px;
  font-size: 20px;
  font-weight: 800;
  color: #fef08a;
`;

const WinnerReasonText = styled.p`
  margin: 0 0 12px;
  font-size: 12px;
  color: #a1a1aa;
`;

const TokenStampContainer = styled.div`
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(212, 175, 55, 0.25);
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 18px;
`;

const TokenLabel = styled.div`
  font-size: 11px;
  color: #d4af37;
  font-weight: 600;
  margin-bottom: 6px;
`;

const StampRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const HeartStamp = styled.span<{ $active: boolean }>`
  font-size: 22px;
  color: ${props => (props.$active ? '#f43f5e' : '#52525b')};
  filter: ${props => (props.$active ? 'drop-shadow(0 0 8px #f43f5e)' : 'none')};
  transition: all 0.3s ease;
`;

const NextRoundBtn = styled.button`
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #d4af37 0%, #aa820a 100%);
  color: #18181b;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(212, 175, 55, 0.3);
`;

const WaitingNotice = styled.div`
  font-size: 12px;
  color: #d4af37;
  padding: 10px;
`;
