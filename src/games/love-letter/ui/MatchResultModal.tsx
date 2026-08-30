import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

interface MatchResultModalProps {
  isOpen: boolean;
  championName: string;
  onReturnToLobby: () => void;
}

export const MatchResultModal: React.FC<MatchResultModalProps> = ({
  isOpen,
  championName,
  onReturnToLobby,
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
          <VictoryCard
            as={motion.div}
            initial={{ scale: 0.6, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.6, y: 40 }}
            transition={{ type: 'spring', stiffness: 250, damping: 20 }}
          >
            <TrophyIcon>🏆</TrophyIcon>
            <VictoryTag>MATCH CHAMPION</VictoryTag>
            <ChampionTitle>황실의 최종 승리자</ChampionTitle>
            <ChampionName>👑 {championName}</ChampionName>
            <VictoryDesc>공주의 마음을 얻고 살롱의 영광을 차지했습니다!</VictoryDesc>

            <LobbyReturnBtn onClick={onReturnToLobby}>
              살롱 로비로 복귀하기
            </LobbyReturnBtn>
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
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 0 50px rgba(212, 175, 55, 0.6);
`;

const TrophyIcon = styled.div`
  font-size: 54px;
  margin-bottom: 10px;
  filter: drop-shadow(0 4px 16px rgba(212, 175, 55, 0.6));
`;

const VictoryTag = styled.span`
  font-size: 11px;
  font-weight: 800;
  color: #d4af37;
  letter-spacing: 2px;
`;

const ChampionTitle = styled.h3`
  margin: 4px 0 8px;
  font-size: 14px;
  color: #a1a1aa;
`;

const ChampionName = styled.h1`
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 800;
  color: #fef08a;
`;

const VictoryDesc = styled.p`
  font-size: 12px;
  color: #d4d4d8;
  margin: 0 0 24px;
  line-height: 1.4;
`;

const LobbyReturnBtn = styled.button`
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #d4af37 0%, #aa820a 100%);
  color: #18181b;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
`;
