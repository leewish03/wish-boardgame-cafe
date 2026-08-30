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
            <PauseTitle>연결 복구 진행 중</PauseTitle>
            <PauseDesc>
              <strong>{pausedPlayerName}</strong> 님의 연결을 복구하고 있습니다…
              <br />
              <SubNotice>(모바일 백그라운드 유예 및 재접속 대기 중)</SubNotice>
            </PauseDesc>
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
  background: rgba(0, 0, 0, 0.82);
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
  border: 1.5px solid #d4af37;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  box-shadow: 0 0 35px rgba(212, 175, 55, 0.4);
`;

const ClockIcon = styled.div`
  font-size: 38px;
  margin-bottom: 8px;
`;

const PauseTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 16px;
  color: #fef08a;
  font-weight: 800;
`;

const PauseDesc = styled.p`
  margin: 0 0 20px;
  font-size: 13px;
  color: #e4e4e7;
  line-height: 1.5;
  strong {
    color: #d4af37;
  }
`;

const SubNotice = styled.span`
  font-size: 11px;
  color: #a1a1aa;
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
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
`;
