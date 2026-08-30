// =========================================================================
// ActionVisualizer.jsx - Full Motion Animation & Action Result Visualizer
// =========================================================================

import React, { useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '../../shared/theme';
import { Shield, Sparkles, AlertTriangle, CheckCircle, XCircle, Swords, Eye, Crown, HeartCrack } from 'lucide-react';

// --- Keyframes ---
const pulseGoldGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 15px rgba(197, 160, 89, 0.4), 0 10px 30px rgba(9, 13, 22, 0.2);
  }
  50% {
    box-shadow: 0 0 35px rgba(197, 160, 89, 0.8), 0 14px 45px rgba(9, 13, 22, 0.35);
  }
`;

const shatterAnimation = keyframes`
  0% { transform: scale(1) rotate(0deg); opacity: 1; filter: none; }
  25% { transform: scale(1.15) rotate(4deg); filter: brightness(1.8) drop-shadow(0 0 20px #dc2626); }
  100% { transform: scale(0.2) rotate(45deg) translateY(40px); opacity: 0; filter: blur(8px); }
`;

const deflectAnimation = keyframes`
  0% { transform: translateX(0) scale(1); }
  30% { transform: translateX(-18px) scale(0.92); }
  60% { transform: translateX(12px) scale(1.05); }
  100% { transform: translateX(0) scale(1); }
`;

const runeRotate = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// --- Styled Components ---

const VisualizerOverlay = styled.div`
  position: absolute;
  top: 48px;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 900;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 14px;
`;

const BannerContainer = styled(motion.div)`
  pointer-events: auto;
  max-width: 92%;
  width: 440px;
  background: ${THEME.gradients.cardMarble};
  border: 1px solid ${THEME.gold};
  border-radius: ${THEME.radius.lg};
  padding: 12px 16px;
  box-shadow: 0 12px 35px rgba(9, 13, 22, 0.25), 0 0 20px rgba(197, 160, 89, 0.35);
  animation: ${pulseGoldGlow} 2.4s infinite ease-in-out;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 3px;
    border: 0.5px solid rgba(197, 160, 89, 0.4);
    border-radius: calc(${THEME.radius.lg} - 3px);
    pointer-events: none;
  }
`;

const BannerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const PlayerBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;

  img {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1.5px solid ${THEME.gold};
    object-fit: cover;
  }

  span {
    font-size: 13px;
    font-weight: 700;
    color: ${THEME.foreground};
    font-family: ${THEME.font.koreanSerif};
  }
`;

const ActionArrow = styled.div`
  font-size: 13px;
  font-weight: 800;
  color: ${THEME.burgundy};
  display: flex;
  align-items: center;
  gap: 4px;
`;

const CardChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: ${THEME.gradients.obsidianButton};
  border: 1px solid ${THEME.gold};
  border-radius: ${THEME.radius.full};
  padding: 3px 10px;
  color: #f8fafc;
  font-size: 12px;
  font-weight: 700;
  font-family: ${THEME.font.koreanSerif};

  span.val {
    color: ${THEME.gold};
    font-family: ${THEME.font.serif};
    font-weight: 900;
  }
`;

const BannerResultText = styled.div`
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: ${({ $isSuccess, $isEliminated }) =>
    $isEliminated ? '#991b1b' : $isSuccess ? '#15803d' : '#475569'};
  background: rgba(255, 255, 255, 0.7);
  border-radius: ${THEME.radius.md};
  padding: 6px 10px;
  border-left: 3px solid
    ${({ $isSuccess, $isEliminated }) =>
      $isEliminated ? '#dc2626' : $isSuccess ? '#16a34a' : THEME.gold};
  display: flex;
  align-items: center;
  gap: 6px;
`;

// --- Special Card Action Effects ---

const CenterEffectModal = styled(motion.div)`
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 950;
`;

const MarbleCardPreview = styled.div`
  width: 90px;
  height: 125px;
  background: ${THEME.gradients.cardMarble};
  border: 1.5px solid ${THEME.gold};
  border-radius: ${THEME.radius.md};
  box-shadow: 0 14px 35px rgba(9, 13, 22, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  position: relative;

  ${({ $shatter }) =>
    $shatter &&
    css`
      animation: ${shatterAnimation} 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    `}

  ${({ $deflect }) =>
    $deflect &&
    css`
      animation: ${deflectAnimation} 0.6s ease-in-out;
    `}
`;

const ShieldRuneRing = styled.div`
  position: absolute;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  border: 2px dashed #10b981;
  box-shadow: 0 0 25px rgba(16, 185, 129, 0.5);
  animation: ${runeRotate} 6s linear infinite;
  pointer-events: none;
`;

export function ActionVisualizer({ lastAction, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastAction || !lastAction.playedCard) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      if (typeof onDismiss === 'function') onDismiss();
    }, 2000);

    return () => clearTimeout(timer);
  }, [lastAction, onDismiss]);

  if (!visible || !lastAction || !lastAction.playedCard) return null;

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
  } = lastAction;

  const isGuardSuccess = resultType === 'GUARD_SUCCESS';
  const isGuardFail = resultType === 'GUARD_FAIL';
  const isBaron = resultType?.startsWith('BARON');
  const isHandmaid = resultType === 'HANDMAID_PROTECT' || playedCard?.value === 4;
  const isPrince = resultType?.startsWith('PRINCE') || playedCard?.value === 5;
  const isKing = resultType === 'KING_SWAP' || playedCard?.value === 6;
  const isPrincessEliminated = resultType === 'PRINCESS_SELF_ELIMINATED' || (isPrince && resultType === 'PRINCE_PRINCESS_ELIMINATED');

  return (
    <VisualizerOverlay>
      <AnimatePresence>
        <BannerContainer
          initial={{ y: -40, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -30, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        >
          <BannerHeader>
            <PlayerBadge>
              {actorAvatar && <img src={actorAvatar} alt={actorNickname} />}
              <span>{actorNickname || '플레이어'}</span>
            </PlayerBadge>

            {targetNickname && (
              <ActionArrow>
                ➔
                <PlayerBadge style={{ marginLeft: '4px' }}>
                  {targetAvatar && <img src={targetAvatar} alt={targetNickname} />}
                  <span style={{ color: THEME.mutedForeground }}>{targetNickname}</span>
                </PlayerBadge>
              </ActionArrow>
            )}

            <CardChip>
              <span className="val">{playedCard.value}</span>
              <span>{playedCard.name}</span>
            </CardChip>
          </BannerHeader>

          {guessedCard && (
            <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>추측 카드:</span>
              <strong style={{ color: THEME.burgundy }}>[{guessedCard.value}] {guessedCard.name}</strong>
            </div>
          )}

          <BannerResultText
            $isSuccess={isGuardSuccess || resultType === 'BARON_WIN'}
            $isEliminated={!!eliminatedPlayerId}
          >
            {isGuardSuccess && <CheckCircle size={14} color="#16a34a" />}
            {isGuardFail && <XCircle size={14} color="#64748b" />}
            {isPrincessEliminated && <HeartCrack size={14} color="#dc2626" />}
            {isHandmaid && <Shield size={14} color="#10b981" />}
            {isBaron && <Swords size={14} color="#c5a059" />}
            {isKing && <Crown size={14} color="#c5a059" />}
            {resultType === 'PRIEST_PEEK' && <Eye size={14} color="#6366f1" />}
            <span>{resultDescription}</span>
          </BannerResultText>
        </BannerContainer>
      </AnimatePresence>

      {/* Special Center Collision / Shield Overlay Effects */}
      {isHandmaid && (
        <CenterEffectModal
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
        >
          <ShieldRuneRing />
          <Shield size={44} color="#10b981" />
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#065f46', fontFamily: THEME.font.koreanSerif, background: 'rgba(255,255,255,0.9)', padding: '2px 8px', borderRadius: '12px' }}>
            면역 보호막 전개 (다음 턴까지 안전)
          </span>
        </CenterEffectModal>
      )}

      {isGuardSuccess && (
        <CenterEffectModal
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1.1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
        >
          <MarbleCardPreview $shatter>
            <span style={{ fontSize: '16px', fontWeight: 900, color: THEME.burgundy, fontFamily: THEME.font.serif }}>
              {guessedCard?.value || 'TARGET'}
            </span>
            <AlertTriangle size={28} color="#dc2626" />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626' }}>저격 적중!</span>
          </MarbleCardPreview>
        </CenterEffectModal>
      )}

      {isGuardFail && (
        <CenterEffectModal
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
        >
          <MarbleCardPreview $deflect>
            <Shield size={32} color="#c5a059" />
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>빗나감</span>
          </MarbleCardPreview>
        </CenterEffectModal>
      )}
    </VisualizerOverlay>
  );
}
export default ActionVisualizer;
