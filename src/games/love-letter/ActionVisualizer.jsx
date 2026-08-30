// =========================================================================
// ActionVisualizer.jsx - Slim Banner & Spatial Projectile Beam Engine (Zero-Modal)
// =========================================================================

import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '../../shared/theme';
import { Shield, Sparkles, CheckCircle, XCircle, Swords, Eye, Crown, HeartCrack } from 'lucide-react';

// --- Keyframes ---
const pulseGoldGlow = keyframes`
  0%, 100% {
    box-shadow: 0 4px 16px rgba(197, 160, 89, 0.35), 0 2px 8px rgba(9, 13, 22, 0.15);
  }
  50% {
    box-shadow: 0 6px 24px rgba(197, 160, 89, 0.65), 0 4px 12px rgba(9, 13, 22, 0.25);
  }
`;

const beamDash = keyframes`
  0% { stroke-dashoffset: 300; opacity: 0.3; }
  35% { opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0; }
`;

const impactExpand = keyframes`
  0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
  40% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(2.0); opacity: 0; }
`;

const sparkPop = keyframes`
  0% { transform: translate(-50%, -50%) scale(0.3) rotate(0deg); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(1.4) rotate(45deg); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.8) rotate(90deg); opacity: 0; }
`;

// --- Styled Components ---

const VisualizerOverlay = styled.div`
  position: absolute;
  top: 38px;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 850;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 6px;
  overflow: hidden;
`;

const SlimBannerContainer = styled(motion.div)`
  pointer-events: auto;
  max-width: 94%;
  width: 480px;
  background: #ffffff;
  background-image: ${THEME.gradients.marbleTextureUrl}, ${THEME.gradients.marbleSlab};
  background-size: cover;
  border: 1.5px solid ${THEME.gold};
  border-radius: ${THEME.radius.lg};
  padding: 8px 12px;
  box-shadow: 0 8px 24px rgba(9, 13, 22, 0.2), 0 0 16px rgba(197, 160, 89, 0.35);
  animation: ${pulseGoldGlow} 2.4s infinite ease-in-out;
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;

  &::before {
    content: '';
    position: absolute;
    inset: 2px;
    border: 0.5px solid rgba(197, 160, 89, 0.4);
    border-radius: calc(${THEME.radius.lg} - 2px);
    pointer-events: none;
  }
`;

const BannerTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
`;

const ActorTargetGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
`;

const PlayerBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;

  img {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid ${THEME.gold};
    object-fit: cover;
  }

  span {
    font-size: 12px;
    font-weight: 800;
    color: ${THEME.foreground};
    font-family: ${THEME.font.koreanSerif};
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const ActionArrow = styled.span`
  font-size: 11px;
  font-weight: 900;
  color: ${THEME.goldLight};
`;

const CardChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: ${THEME.gradients.obsidianButton};
  border: 1px solid ${THEME.gold};
  border-radius: ${THEME.radius.full};
  padding: 2px 8px;
  color: #f8fafc;
  font-size: 11px;
  font-weight: 700;
  font-family: ${THEME.font.koreanSerif};
  white-space: nowrap;
  flex-shrink: 0;

  span.val {
    color: ${THEME.gold};
    font-family: ${THEME.font.serif};
    font-weight: 900;
    font-size: 11px;
  }
`;

const BannerResultRow = styled.div`
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
  color: ${({ $isSuccess, $isEliminated }) =>
    $isEliminated ? '#991b1b' : $isSuccess ? '#15803d' : '#334155'};
  background: rgba(255, 255, 255, 0.88);
  border-radius: ${THEME.radius.sm};
  padding: 4px 8px;
  border-left: 3px solid
    ${({ $isSuccess, $isEliminated }) =>
      $isEliminated ? '#dc2626' : $isSuccess ? '#16a34a' : THEME.gold};
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// --- Projectile Beam SVG & Impact Layer ---

const ProjectileStage = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 840;
`;

const ProjectileRay = styled.path`
  stroke: ${({ $color }) => $color || THEME.gold};
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-dasharray: 16 8;
  fill: none;
  filter: drop-shadow(0 0 8px ${({ $glow }) => $glow || 'rgba(212, 175, 55, 0.9)'});
  animation: ${beamDash} 0.65s ease-out forwards;
`;

const ImpactPortal = styled.div`
  position: absolute;
  left: ${({ $x }) => $x}px;
  top: ${({ $y }) => $y}px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 860;
`;

const ImpactWave = styled.div`
  position: absolute;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 2px solid ${({ $color }) => $color || THEME.gold};
  box-shadow: 0 0 18px ${({ $glow }) => $glow || 'rgba(212, 175, 55, 0.8)'};
  animation: ${impactExpand} 0.6s ease-out forwards;
`;

const HitSpark = styled.div`
  position: absolute;
  font-size: 22px;
  animation: ${sparkPop} 0.55s ease-out forwards;
`;

export function ActionVisualizer({ lastAction, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!lastAction || !lastAction?.playedCard) {
      setVisible(false);
      setCoords(null);
      return;
    }

    setVisible(true);

    // Calculate actor & target seat coordinates from DOM
    try {
      const actorEl = document.querySelector(`[data-player-id="${lastAction.actorId}"]`);
      const targetEl = lastAction.targetId
        ? document.querySelector(`[data-player-id="${lastAction.targetId}"]`)
        : null;

      if (actorEl && targetEl) {
        const actorRect = actorEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        setCoords({
          startX: actorRect.left + actorRect.width / 2,
          startY: actorRect.top + actorRect.height / 2,
          targetX: targetRect.left + targetRect.width / 2,
          targetY: targetRect.top + targetRect.height / 2,
        });
      } else {
        setCoords(null);
      }
    } catch {
      setCoords(null);
    }

    const timer = setTimeout(() => {
      setVisible(false);
      setCoords(null);
      if (typeof onDismiss === 'function') onDismiss();
    }, 2200);

    return () => clearTimeout(timer);
  }, [lastAction, onDismiss]);

  if (!visible || !lastAction || !lastAction?.playedCard) return null;

  const {
    actorNickname,
    actorAvatar,
    targetNickname,
    targetAvatar,
    playedCard = {},
    guessedCard,
    resultType,
    resultDescription,
    eliminatedPlayerId,
  } = lastAction || {};

  const isGuardSuccess = resultType === 'GUARD_SUCCESS';
  const isGuardFail = resultType === 'GUARD_FAIL';
  const isBaron = resultType?.startsWith?.('BARON');
  const isHandmaid = resultType === 'HANDMAID_PROTECT' || playedCard?.value === 4;
  const isPrince = resultType?.startsWith?.('PRINCE') || playedCard?.value === 5;
  const isKing = resultType === 'KING_SWAP' || playedCard?.value === 6;
  const isPrincessEliminated = resultType === 'PRINCESS_SELF_ELIMINATED' || (isPrince && resultType === 'PRINCE_PRINCESS_ELIMINATED');

  // Beam Colors
  const beamColor = isGuardSuccess || resultType === 'BARON_WIN'
    ? '#16a34a'
    : isPrincessEliminated || !!eliminatedPlayerId
    ? '#dc2626'
    : isHandmaid
    ? '#10b981'
    : THEME.gold;

  const beamGlow = isGuardSuccess
    ? 'rgba(22, 163, 74, 0.8)'
    : isPrincessEliminated
    ? 'rgba(220, 38, 38, 0.8)'
    : 'rgba(212, 175, 55, 0.9)';

  return (
    <VisualizerOverlay>
      {/* 1. Projectile Laser Beam from Actor to Target */}
      {coords && (
        <ProjectileStage>
          <ProjectileRay
            $color={beamColor}
            $glow={beamGlow}
            d={`M ${coords.startX} ${coords.startY} Q ${(coords.startX + coords.targetX) / 2} ${
              (coords.startY + coords.targetY) / 2 - 40
            } ${coords.targetX} ${coords.targetY}`}
          />
        </ProjectileStage>
      )}

      {/* 2. Impact Hit Sparkles at Target */}
      {coords && (
        <ImpactPortal $x={coords.targetX} $y={coords.targetY}>
          <ImpactWave $color={beamColor} $glow={beamGlow} />
          <HitSpark>
            {isGuardSuccess ? '🎯' : isPrincessEliminated ? '💥' : isHandmaid ? '🛡️' : '✨'}
          </HitSpark>
        </ImpactPortal>
      )}

      {/* 3. Top Slim Gold-Marble Summary Banner */}
      <AnimatePresence>
        <SlimBannerContainer
          initial={{ y: -30, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        >
          <BannerTopRow>
            <ActorTargetGroup>
              <PlayerBadge>
                {actorAvatar && <img src={actorAvatar} alt={actorNickname || '플레이어'} />}
                <span>{actorNickname || '플레이어'}</span>
              </PlayerBadge>

              {targetNickname && (
                <>
                  <ActionArrow>➔</ActionArrow>
                  <PlayerBadge>
                    {targetAvatar && <img src={targetAvatar} alt={targetNickname} />}
                    <span style={{ color: THEME.mutedForeground }}>{targetNickname}</span>
                  </PlayerBadge>
                </>
              )}
            </ActorTargetGroup>

            <CardChip>
              <span className="val">{playedCard?.value ?? ''}</span>
              <span>{playedCard?.name || '카드'}</span>
            </CardChip>
          </BannerTopRow>

          {guessedCard && (
            <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>추측 카드:</span>
              <strong style={{ color: THEME.burgundy }}>[{guessedCard?.value}] {guessedCard?.name}</strong>
            </div>
          )}

          <BannerResultRow
            $isSuccess={isGuardSuccess || resultType === 'BARON_WIN'}
            $isEliminated={!!eliminatedPlayerId}
          >
            {isGuardSuccess && <CheckCircle size={13} color="#16a34a" />}
            {isGuardFail && <XCircle size={13} color="#64748b" />}
            {isPrincessEliminated && <HeartCrack size={13} color="#dc2626" />}
            {isHandmaid && <Shield size={13} color="#10b981" />}
            {isBaron && <Swords size={13} color="#c5a059" />}
            {isKing && <Crown size={13} color="#c5a059" />}
            {resultType === 'PRIEST_PEEK' && <Eye size={13} color="#6366f1" />}
            <span>{resultDescription}</span>
          </BannerResultRow>
        </SlimBannerContainer>
      </AnimatePresence>
    </VisualizerOverlay>
  );
}

export default ActionVisualizer;
