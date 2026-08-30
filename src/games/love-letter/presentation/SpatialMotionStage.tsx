import React from 'react';
import styled, { keyframes, css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { getHeraldicIcon } from './heraldicIcons';
import { Shield, Sparkles, HeartCrack, Swords, Crown, Eye, Scroll } from 'lucide-react';

interface SpatialMotionStageProps {
  currentAction: GameEventEnvelope | null;
}

export const SpatialMotionStage: React.FC<SpatialMotionStageProps> = ({ currentAction }) => {
  if (!currentAction || !currentAction.event) return null;

  const { event } = currentAction;

  return (
    <OverlayContainer pointerEvents="none">
      <AnimatePresence>
        {/* 공통 슬림 액션 배너 */}
        {event.type === 'CARD_PLAYED' && (
          <ActionBanner
            as={motion.div}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            <ActionEmblem>{getHeraldicIcon(event.card.value, 22)}</ActionEmblem>
            <ActionText>
              <ActorName>{event.actorId}</ActorName> 님이 <strong>[{event.card.name}]</strong> 사용!
            </ActionText>
          </ActionBanner>
        )}

        {/* 1. 경비병 (Guard): 레이저 빔 + 추측 결과 (Match/Miss) */}
        {event.type === 'CARD_GUESSED' && (
          <SnipeBeamOverlay
            as={motion.div}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <BeamLaser />
            <SnipeTargetCircle>🎯 [{event.guessedValue}번] 추측 저격!</SnipeTargetCircle>
          </SnipeBeamOverlay>
        )}

        {/* 2. 사제 (Priest): 비밀 투시 안내 */}
        {event.type === 'CARD_PLAYED' && event.card.value === 2 && (
          <PriestPeekBanner
            as={motion.div}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Eye size={16} color="#4fd1c5" />
            <span>비밀 투시: 상대 손패를 은밀히 확인했습니다.</span>
          </PriestPeekBanner>
        )}

        {/* 3. 남작 (Baron): VS 대결 박스 연출 */}
        {event.type === 'PLAYER_ELIMINATED' && event.reason?.includes('BARON') && (
          <DuelClashOverlay
            as={motion.div}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 1.15, 1], opacity: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.45 }}
          >
            <ClashTitle>⚔️ [Player A 🎴] VS [Player B 🎴]</ClashTitle>
            <ClashSubtitle>더 낮은 숫자의 카드를 가진 쪽이 탈락합니다!</ClashSubtitle>
          </DuelClashOverlay>
        )}

        {/* 4. 하녀 (Handmaid): 회전 룬 보호막 */}
        {event.type === 'CARD_PLAYED' && event.card.value === 4 && (
          <ShieldAuraOverlay
            as={motion.div}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ShieldRuneRing />
            <Shield size={36} color="#10b981" />
            <ShieldText>🌸 면역 보호막 전개 (다음 턴까지 안전)</ShieldText>
          </ShieldAuraOverlay>
        )}

        {/* 5. 왕자 (Prince): 와류 버림 모션 */}
        {event.type === 'CARD_PLAYED' && event.card.value === 5 && (
          <VortexDiscardOverlay
            as={motion.div}
            initial={{ rotate: 0, scale: 0.6, opacity: 0 }}
            animate={{ rotate: 360, scale: 1, opacity: 1 }}
            exit={{ scale: 0.2, opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Crown size={32} color="#ecc94b" />
            <span>👑 왕자의 명령: 손패를 버리고 새로 드로우!</span>
          </VortexDiscardOverlay>
        )}

        {/* 6. 국왕 (King): 대각선 맞교환 연출 */}
        {event.type === 'CARD_PLAYED' && event.card.value === 6 && (
          <KingSwapOverlay
            as={motion.div}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          >
            <SwapCardsVisual>
              <MiniCardBack style={{ transform: 'rotate(-12deg)' }}>🎴</MiniCardBack>
              <SwapArrows>⇄</SwapArrows>
              <MiniCardBack style={{ transform: 'rotate(12deg)' }}>🎴</MiniCardBack>
            </SwapCardsVisual>
            <span>🤴 국왕의 칙령: 비밀 손패 맞교환!</span>
          </KingSwapOverlay>
        )}

        {/* 7. 백작부인 (Countess): 황실 장미 이펙트 */}
        {event.type === 'CARD_PLAYED' && event.card.value === 7 && (
          <CountessRoseOverlay
            as={motion.div}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <RoseIcon>🌹</RoseIcon>
            <span>황실의 품격: 백작부인의 우아한 이동</span>
          </CountessRoseOverlay>
        )}

        {/* 8. 공주 (Princess) / 일반 탈락: 하트 파괴 및 충격파 */}
        {event.type === 'PLAYER_ELIMINATED' && (
          <PrincessShatterOverlay
            as={motion.div}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <HeartCrack size={42} color="#dc2626" />
            <ShatterText>💥 {event.targetId || '플레이어'} 탈락!</ShatterText>
          </PrincessShatterOverlay>
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
  top: 48px;
  background: rgba(18, 18, 20, 0.92);
  border: 1.5px solid #d4af37;
  border-radius: 20px;
  padding: 6px 14px;
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
  font-size: 11.5px;
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
  top: 42%;
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
  background: rgba(239, 68, 68, 0.95);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  padding: 4px 12px;
  border-radius: 14px;
  box-shadow: 0 0 14px rgba(239, 68, 68, 0.8);
`;

const PriestPeekBanner = styled.div`
  position: absolute;
  top: 42%;
  background: rgba(15, 23, 42, 0.95);
  border: 1.5px solid #4fd1c5;
  border-radius: 16px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e6fffa;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 0 20px rgba(79, 209, 197, 0.4);
`;

const DuelClashOverlay = styled.div`
  background: rgba(18, 18, 20, 0.95);
  border: 2px solid #e11d48;
  border-radius: 16px;
  padding: 14px 20px;
  text-align: center;
  box-shadow: 0 0 30px rgba(225, 29, 72, 0.6);
`;

const ClashTitle = styled.h3`
  margin: 0 0 4px;
  font-size: 15px;
  color: #fb7185;
  font-weight: 800;
`;

const ClashSubtitle = styled.p`
  margin: 0;
  font-size: 11px;
  color: #a1a1aa;
`;

const runeRotate = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const ShieldAuraOverlay = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const ShieldRuneRing = styled.div`
  position: absolute;
  top: -12px;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  border: 2px dashed #10b981;
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.6);
  animation: ${runeRotate} 5s linear infinite;
`;

const ShieldText = styled.span`
  background: rgba(6, 95, 70, 0.9);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 12px;
  margin-top: 10px;
`;

const VortexDiscardOverlay = styled.div`
  background: rgba(18, 18, 20, 0.95);
  border: 1.5px solid #ecc94b;
  border-radius: 16px;
  padding: 10px 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fef08a;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 0 20px rgba(236, 201, 75, 0.4);
`;

const KingSwapOverlay = styled.div`
  background: rgba(18, 18, 20, 0.95);
  border: 1.5px solid #ed8936;
  border-radius: 16px;
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #fed7aa;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 0 20px rgba(237, 137, 54, 0.4);
`;

const SwapCardsVisual = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MiniCardBack = styled.div`
  width: 28px;
  height: 40px;
  background: #7c2d12;
  border: 1px solid #d4af37;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
`;

const SwapArrows = styled.span`
  font-size: 18px;
  color: #ed8936;
  font-weight: 900;
`;

const CountessRoseOverlay = styled.div`
  background: rgba(18, 18, 20, 0.95);
  border: 1.5px solid #f43f5e;
  border-radius: 16px;
  padding: 10px 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fecdd3;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 0 20px rgba(244, 63, 94, 0.4);
`;

const RoseIcon = styled.span`
  font-size: 20px;
`;

const PrincessShatterOverlay = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: rgba(18, 18, 20, 0.95);
  border: 2px solid #dc2626;
  border-radius: 18px;
  padding: 14px 22px;
  box-shadow: 0 0 30px rgba(220, 38, 38, 0.7);
`;

const ShatterText = styled.span`
  font-size: 14px;
  font-weight: 900;
  color: #ef4444;
`;
