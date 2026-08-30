import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

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
            initial={{ scale: 0.6, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.6, y: 40 }}
            transition={{ type: 'spring', stiffness: 250, damping: 20 }}
          >
            <TrophyIcon>🏆</TrophyIcon>
            <VictoryTag>LOVE LETTER - MATCH CHAMPION</VictoryTag>
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
                살롱 카페 로비로 ➔
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
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const VictoryCard = styled.div`
  width: 100%;
  max-width: 380px;
  background: radial-gradient(circle at 50% 30%, #27272a 0%, #18181b 100%);
  border: 2px solid #d4af37;
  border-radius: 20px;
  padding: 30px 24px;
  text-align: center;
  box-shadow: 0 0 50px rgba(212, 175, 55, 0.6);
`;

const TrophyIcon = styled.div`
  font-size: 50px;
  margin-bottom: 8px;
  filter: drop-shadow(0 4px 16px rgba(212, 175, 55, 0.6));
`;

const VictoryTag = styled.span`
  font-size: 11px;
  font-weight: 800;
  color: #d4af37;
  letter-spacing: 2px;
`;

const ChampionTitle = styled.h3`
  margin: 4px 0 6px;
  font-size: 13px;
  color: #a1a1aa;
`;

const ChampionName = styled.h1`
  margin: 0 0 10px;
  font-size: 24px;
  font-weight: 800;
  color: #fef08a;
`;

const StampContainer = styled.div`
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(212, 175, 55, 0.25);
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 12px;
`;

const StampRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const FullHeartStamp = styled.span`
  font-size: 24px;
  color: #f43f5e;
  filter: drop-shadow(0 0 10px #f43f5e);
`;

const TokensCompleteText = styled.div`
  font-size: 11px;
  color: #d4af37;
  font-weight: 600;
  margin-top: 4px;
`;

const VictoryDesc = styled.p`
  font-size: 12px;
  color: #d4d4d8;
  margin: 0 0 20px;
  line-height: 1.4;
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PlayAgainBtn = styled.button`
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #d4af37 0%, #aa820a 100%);
  color: #18181b;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(212, 175, 55, 0.35);
`;

const LobbyReturnBtn = styled.button`
  width: 100%;
  padding: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: #d4af37;
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }
`;
