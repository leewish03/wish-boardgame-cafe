import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

interface PauseOverlayProps {
  isPaused: boolean;
  pausedPlayerName?: string;
  onForfeit: () => void;
}

export const PauseOverlay: React.FC<PauseOverlayProps> = ({
  isPaused,
  pausedPlayerName = '플레이어',
  onForfeit,
}) => {
  return (
    <AnimatePresence>
      {isPaused && (
        <Overlay
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <PauseBox
            as={motion.div}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
          >
            <ClockIcon>⏳</ClockIcon>
            <PauseTitle>플레이어 연결 끊김 일시정지</PauseTitle>
            <PauseDesc>[{pausedPlayerName}] 님의 재접속을 기다리는 중입니다 (최대 3분 유예)</PauseDesc>
            <ForfeitBtn onClick={onForfeit}>기권하고 나가기</ForfeitBtn>
          </PauseBox>
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
  z-index: 1800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const PauseBox = styled.div`
  width: 100%;
  max-width: 360px;
  background: #18181b;
  border: 1.5px solid #f59e0b;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  box-shadow: 0 0 30px rgba(245, 158, 11, 0.4);
`;

const ClockIcon = styled.div`
  font-size: 40px;
  margin-bottom: 8px;
`;

const PauseTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 16px;
  color: #f59e0b;
  font-weight: 700;
`;

const PauseDesc = styled.p`
  margin: 0 0 20px;
  font-size: 12px;
  color: #a1a1aa;
  line-height: 1.4;
`;

const ForfeitBtn = styled.button`
  padding: 10px 18px;
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
`;
