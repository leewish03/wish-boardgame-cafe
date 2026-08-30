import React from 'react';
import styled, { keyframes } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { getHeraldicIcon } from './heraldicIcons';

interface SpatialMotionStageProps {
  currentAction: GameEventEnvelope | null;
}

export const SpatialMotionStage: React.FC<SpatialMotionStageProps> = ({ currentAction }) => {
  if (!currentAction || !currentAction.event) return null;

  const { event } = currentAction;

  return (
    <OverlayContainer pointerEvents="none">
      <AnimatePresence>
        {event.type === 'CARD_PLAYED' && (
          <ActionBanner
            as={motion.div}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            <ActionEmblem>{getHeraldicIcon(event.card.value, 24)}</ActionEmblem>
            <ActionText>
              <ActorName>{event.actorId}</ActorName> 님이 <strong>[{event.card.name}]</strong> 사용!
            </ActionText>
          </ActionBanner>
        )}

        {/* 1번 경비병 레이저 저격 연출 */}
        {event.type === 'CARD_GUESSED' && (
          <SnipeBeamOverlay
            as={motion.div}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <BeamLaser />
            <SnipeTargetCircle>🎯 {event.guessedValue}번 추측!</SnipeTargetCircle>
          </SnipeBeamOverlay>
        )}

        {/* 3번 남작 결투 연출 */}
        {event.type === 'PLAYER_ELIMINATED' && event.reason?.includes('BARON') && (
          <DuelClashOverlay
            as={motion.div}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1.2, 1], opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ClashTitle>⚔️ 남작 결투 판정!</ClashTitle>
            <ClashSubtitle>더 낮은 패를 쥔 자가 탈락합니다</ClashSubtitle>
          </DuelClashOverlay>
        )}

        {/* 8번 공주 / 일반 탈락 샤터 연출 */}
        {event.type === 'PLAYER_ELIMINATED' && (
          <ShatterEffect
            as={motion.div}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 0, scale: 1.8 }}
            transition={{ duration: 0.6 }}
          >
            💥 탈락!
          </ShatterEffect>
        )}
      </AnimatePresence>
    </OverlayContainer>
  );
};

const OverlayContainer = styled.div<{ pointerEvents?: string }>`
  position: absolute;
  inset: 0;
  pointer-events: ${props => props.pointerEvents || 'none'};
  z-index: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const ActionBanner = styled.div`
  position: absolute;
  top: 56px;
  background: rgba(18, 18, 20, 0.95);
  border: 1.5px solid #d4af37;
  border-radius: 20px;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 14px rgba(212, 175, 55, 0.35);
`;

const ActionEmblem = styled.div`
  display: flex;
  align-items: center;
`;

const ActionText = styled.span`
  font-size: 12px;
  color: #fff;
  strong {
    color: #fef08a;
  }
`;

const ActorName = styled.span`
  color: #d4af37;
  font-weight: 700;
`;

const SnipeBeamOverlay = styled.div`
  position: absolute;
  top: 40%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const beamPulse = keyframes`
  0%, 100% { opacity: 0.8; filter: drop-shadow(0 0 8px #f59e0b); }
  50% { opacity: 1; filter: drop-shadow(0 0 18px #ef4444); }
`;

const BeamLaser = styled.div`
  width: 240px;
  height: 4px;
  background: linear-gradient(90deg, transparent 0%, #f59e0b 50%, #ef4444 100%);
  border-radius: 2px;
  animation: ${beamPulse} 0.5s infinite;
`;

const SnipeTargetCircle = styled.div`
  background: rgba(239, 68, 68, 0.9);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 12px;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.8);
`;

const DuelClashOverlay = styled.div`
  background: rgba(18, 18, 20, 0.95);
  border: 2px solid #e11d48;
  border-radius: 16px;
  padding: 16px 24px;
  text-align: center;
  box-shadow: 0 0 30px rgba(225, 29, 72, 0.6);
`;

const ClashTitle = styled.h3`
  margin: 0 0 4px;
  font-size: 16px;
  color: #fb7185;
  font-weight: 800;
`;

const ClashSubtitle = styled.p`
  margin: 0;
  font-size: 11px;
  color: #a1a1aa;
`;

const ShatterEffect = styled.div`
  font-size: 28px;
  font-weight: 900;
  color: #ef4444;
  text-shadow: 0 0 20px rgba(239, 68, 68, 0.9);
`;
