import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '../../../shared/theme';

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
            <PauseTitle>연결 복구 대기 중</PauseTitle>
            <PauseDesc>
              <strong>{pausedPlayerName}</strong> 님의 네트워크 연결을 복구하고 있습니다…
              <br />
              <SubNotice>(모바일 백그라운드 유예 시간 대기 중)</SubNotice>
            </PauseDesc>
            <ForfeitBtn onClick={onForfeit}>살롱 로비로 나가기</ForfeitBtn>
          </PauseBox>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(9, 13, 22, 0.75);
  backdrop-filter: blur(8px);
  z-index: 1800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const PauseBox = styled.div`
  width: 100%;
  max-width: 340px;
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleSlab};
  border: 1.5px solid ${THEME.gold};
  border-radius: ${THEME.radius.xl};
  padding: 24px 20px;
  text-align: center;
  box-shadow: 0 16px 40px rgba(9, 13, 22, 0.35);
  box-sizing: border-box;
`;

const ClockIcon = styled.div`
  font-size: 34px;
  margin-bottom: 6px;
`;

const PauseTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 15px;
  color: ${THEME.foreground};
  font-family: ${THEME.font.serif};
  font-weight: 800;
`;

const PauseDesc = styled.p`
  margin: 0 0 18px;
  font-size: 12px;
  color: ${THEME.mutedForeground};
  line-height: 1.45;

  strong {
    color: ${THEME.burgundy};
  }
`;

const SubNotice = styled.span`
  font-size: 10.5px;
  color: ${THEME.mutedForeground};
`;

const ForfeitBtn = styled.button`
  padding: 10px 18px;
  background: ${THEME.destructive};
  color: #ffffff;
  border: none;
  border-radius: ${THEME.radius.md};
  font-weight: 700;
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #881337;
  }
`;
