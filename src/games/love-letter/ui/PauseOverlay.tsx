import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock3 } from 'lucide-react';
import { THEME } from '../../../shared/theme';

interface PauseOverlayProps {
  isPaused: boolean;
  pausedPlayerName?: string;
  pauseExpiresAt?: number | null;
  onLeaveLobby: () => void;
}

export const PauseOverlay: React.FC<PauseOverlayProps> = ({
  isPaused,
  pausedPlayerName = '플레이어',
  pauseExpiresAt,
  onLeaveLobby,
}) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isPaused) return undefined;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [isPaused]);
  const remainingMs = Math.max(0, Number(pauseExpiresAt || 0) - now);
  const remainingSeconds = Math.ceil(remainingMs / 1_000);
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
            <ClockIcon><Clock3 size={32} strokeWidth={1.6} aria-hidden="true" /></ClockIcon>
            <PauseTitle>연결 복구 대기 중</PauseTitle>
            <PauseDesc>
              <strong>{pausedPlayerName}</strong> 님의 네트워크 연결을 복구하고 있습니다…
              <br />
              <SubNotice>{remainingSeconds > 0
                ? `${remainingSeconds}초 안에 돌아오지 않으면 자동으로 퇴장 처리됩니다.`
                : '재접속 시간을 마쳐 게임 상태를 정리하고 있습니다.'}</SubNotice>
            </PauseDesc>
            <ForfeitBtn onClick={onLeaveLobby}>지금 살롱 로비로 나가기</ForfeitBtn>
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
  color: ${THEME.gold};
  line-height: 1;
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
