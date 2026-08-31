import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '../../../shared/theme';

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
            initial={{ scale: 0.7, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.7, y: 20 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          >
            <WaxSealStamp>💌</WaxSealStamp>
            <RoundBadge>ROUND {roundNumber} 승리</RoundBadge>
            <WinnerName>👑 {winnerName}</WinnerName>
            <WinnerReasonText>{winnerReason}</WinnerReasonText>

            <TokenStampContainer>
              <TokenLabel>호감도 토큰 획득 현황 ({winnerTokens}/{targetTokens}):</TokenLabel>
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
  background: rgba(9, 13, 22, 0.8);
  backdrop-filter: blur(8px);
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const ResultCard = styled.div`
  width: 100%;
  max-width: 360px;
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleSlab};
  border: 2px solid ${THEME.gold};
  border-radius: ${THEME.radius.xl};
  padding: 24px 20px;
  text-align: center;
  box-shadow: 0 16px 40px rgba(9, 13, 22, 0.4), 0 0 24px rgba(197, 160, 89, 0.35);
  box-sizing: border-box;
`;

const WaxSealStamp = styled.div`
  font-size: 34px;
  margin-bottom: 6px;
  filter: drop-shadow(0 2px 6px rgba(99, 19, 38, 0.3));
`;

const RoundBadge = styled.div`
  display: inline-block;
  font-family: ${THEME.font.serif};
  font-size: 11px;
  font-weight: 900;
  color: ${THEME.goldLight};
  background: ${THEME.gradients.obsidianButton};
  border: 1px solid ${THEME.gold};
  padding: 2px 10px;
  border-radius: ${THEME.radius.full};
  letter-spacing: 0.08em;
  margin-bottom: 8px;
`;

const WinnerName = styled.h2`
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 900;
  color: ${THEME.foreground};
  font-family: ${THEME.font.serif};
`;

const WinnerReasonText = styled.p`
  margin: 0 0 16px;
  font-size: 12px;
  color: ${THEME.mutedForeground};
`;

const TokenStampContainer = styled.div`
  background: #f8fafc;
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.lg};
  padding: 10px 14px;
  margin-bottom: 18px;
`;

const TokenLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: ${THEME.mutedForeground};
  margin-bottom: 6px;
`;

const StampRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const HeartStamp = styled.span<{ $active: boolean }>`
  font-size: 18px;
  line-height: 1;
  color: ${props => (props.$active ? THEME.burgundy : '#cbd5e1')};
  filter: ${props => (props.$active ? 'drop-shadow(0 2px 4px rgba(99, 19, 38, 0.4))' : 'none')};
`;

const NextRoundBtn = styled.button`
  width: 100%;
  height: 42px;
  background: ${THEME.gradients.goldShimmer};
  color: ${THEME.foreground};
  font-family: ${THEME.font.serif};
  font-weight: 900;
  font-size: 13.5px;
  border: 1px solid ${THEME.goldAntique};
  border-radius: ${THEME.radius.md};
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(197, 160, 89, 0.4);
  transition: all 0.15s ease;

  &:hover {
    filter: brightness(1.06);
    box-shadow: 0 6px 18px rgba(197, 160, 89, 0.6);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const WaitingNotice = styled.p`
  margin: 0;
  font-size: 11.5px;
  color: ${THEME.mutedForeground};
  line-height: 1.4;
`;
