import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '../../../shared/theme';

interface MatchResultModalProps {
  isOpen: boolean;
  championName: string;
  targetTokens?: number;
  onPlayAgain?: () => void;
  onReturnToLobby: () => void;
}

export const MatchResultModal: React.FC<MatchResultModalProps> = ({
  isOpen,
  championName,
  targetTokens = 4,
  onPlayAgain,
  onReturnToLobby,
}) => {
  const renderTokens = () => {
    return Array.from({ length: targetTokens }).map((_, i) => (
      <FullHeartStamp key={i}>♥</FullHeartStamp>
    ));
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
          <VictoryCard
            as={motion.div}
            initial={{ scale: 0.7, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.7, y: 30 }}
            transition={{ type: 'spring', stiffness: 250, damping: 20 }}
          >
            <TrophyIcon>🏆</TrophyIcon>
            <VictoryTag>LOVE LETTER MATCH CHAMPION</VictoryTag>
            <ChampionTitle>황실의 최종 승리자</ChampionTitle>
            <ChampionName>👑 {championName}</ChampionName>

            <StampContainer>
              <StampRow>{renderTokens()}</StampRow>
              <TokensCompleteText>목표 호감도 달성 ({targetTokens}/{targetTokens})</TokensCompleteText>
            </StampContainer>

            <VictoryDesc>공주의 마음을 온전히 얻어 살롱 최고의 명예를 거머쥐었습니다!</VictoryDesc>

            <ButtonGroup>
              {onPlayAgain && (
                <PlayAgainBtn onClick={onPlayAgain}>
                  다시 플레이 ↺
                </PlayAgainBtn>
              )}
              <LobbyReturnBtn onClick={onReturnToLobby}>
                살롱 로비로 ➔
              </LobbyReturnBtn>
            </ButtonGroup>
          </VictoryCard>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(9, 13, 22, 0.85);
  backdrop-filter: blur(10px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const VictoryCard = styled.div`
  width: 100%;
  max-width: 360px;
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleSlab};
  border: 2px solid ${THEME.gold};
  border-radius: 20px;
  padding: 26px 20px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(9, 13, 22, 0.45), 0 0 35px rgba(197, 160, 89, 0.5);
  box-sizing: border-box;
`;

const TrophyIcon = styled.div`
  font-size: 44px;
  margin-bottom: 6px;
  filter: drop-shadow(0 4px 12px rgba(197, 160, 89, 0.6));
`;

const VictoryTag = styled.span`
  font-family: ${THEME.font.serif};
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: ${THEME.goldAntique};
  text-transform: uppercase;
  display: block;
  margin-bottom: 4px;
`;

const ChampionTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: ${THEME.mutedForeground};
`;

const ChampionName = styled.h2`
  margin: 4px 0 14px;
  font-family: ${THEME.font.serif};
  font-size: 22px;
  font-weight: 900;
  color: ${THEME.burgundy};
`;

const StampContainer = styled.div`
  background: #f8fafc;
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.lg};
  padding: 10px 14px;
  margin-bottom: 14px;
`;

const StampRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 4px;
`;

const FullHeartStamp = styled.span`
  font-size: 20px;
  color: ${THEME.burgundy};
  filter: drop-shadow(0 2px 4px rgba(99, 19, 38, 0.4));
`;

const TokensCompleteText = styled.span`
  font-size: 11px;
  font-weight: 800;
  color: ${THEME.goldAntique};
`;

const VictoryDesc = styled.p`
  font-size: 12px;
  color: ${THEME.mutedForeground};
  margin: 0 0 20px;
  line-height: 1.4;
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PlayAgainBtn = styled.button`
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
`;

const LobbyReturnBtn = styled.button`
  height: 38px;
  background: #ffffff;
  color: ${THEME.foreground};
  font-family: ${THEME.font.serif};
  font-weight: 800;
  font-size: 12.5px;
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.md};
  cursor: pointer;

  &:hover {
    background: ${THEME.secondary};
    border-color: #cbd5e1;
  }
`;
