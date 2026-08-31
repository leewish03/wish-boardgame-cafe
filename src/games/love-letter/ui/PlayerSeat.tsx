import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { THEME } from '../../../shared/theme';

interface PlayerSeatProps {
  player: PlayerPublic;
  isCurrentTurn: boolean;
  isTargetable: boolean;
  isSelectedTarget: boolean;
  isSelf: boolean;
  isSpeaking?: boolean;
  subtitle?: { text: string; timestamp: number } | null;
  targetDisabledReason?: string;
  onClickTarget?: () => void;
  onInspectDiscards?: () => void;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isCurrentTurn,
  isTargetable,
  isSelectedTarget,
  isSelf,
  isSpeaking = false,
  subtitle,
  targetDisabledReason,
  onClickTarget,
  onInspectDiscards,
}) => {
  const isImageAvatar = player.avatar && (player.avatar.startsWith('http') || player.avatar.startsWith('/'));

  return (
    <SeatWrapper>
      {/* Real-time STT Speech Bubble */}
      <AnimatePresence>
        {subtitle && subtitle.text && (
          <SpeechBubble
            as={motion.div}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            💬 {subtitle.text}
          </SpeechBubble>
        )}
      </AnimatePresence>

      <SeatContainer
        as={motion.div}
        $isCurrentTurn={isCurrentTurn}
        $isTargetable={isTargetable}
        $isSelectedTarget={isSelectedTarget}
        $isEliminated={player.isEliminated}
        $isProtected={player.isProtected}
        onClick={isTargetable ? onClickTarget : undefined}
        whileHover={isTargetable ? { scale: 1.04 } : undefined}
        whileTap={isTargetable ? { scale: 0.96 } : undefined}
        data-player-id={player.id}
      >
        <AvatarRing
          $isCurrentTurn={isCurrentTurn}
          $isProtected={player.isProtected}
          $isSpeaking={isSpeaking}
          $isTargetable={isTargetable}
        >
          {isImageAvatar ? (
            <AvatarImage src={player.avatar} alt={player.nickname} />
          ) : (
            <AvatarIcon>{player.avatar || '👑'}</AvatarIcon>
          )}
          {player.isProtected && <ProtectionBadge title="하녀 면역 보호">🛡️</ProtectionBadge>}
          {player.isEliminated && <EliminatedBadge title="탈락">☠️</EliminatedBadge>}
        </AvatarRing>

        <InfoBlock>
          <NameRow>
            <PlayerName>{player.nickname}</PlayerName>
            {player.isBot && <BotTag>AI</BotTag>}
            {isSelf && <SelfTag>ME</SelfTag>}
          </NameRow>

          <StatsRow>
            <TokenScore title="호감도 토큰">♥ {player.tokens}</TokenScore>
            <HandCount title="손패 수">🃏 {player.cardCount}</HandCount>
          </StatsRow>
        </InfoBlock>

        {player.discardPile && player.discardPile.length > 0 && (
          <DiscardStackButton onClick={onInspectDiscards} title="사용한 카드 확인">
            <DiscardMiniCard>
              {player.discardPile[player.discardPile.length - 1].value}
            </DiscardMiniCard>
            <DiscardCount>+{player.discardPile.length}</DiscardCount>
          </DiscardStackButton>
        )}

        {/* In-place direct targeting prompt */}
        {isTargetable && (
          <TargetPromptBadge>🎯 선택</TargetPromptBadge>
        )}

        {!isTargetable && targetDisabledReason && (
          <TargetDisabledBadge>{targetDisabledReason}</TargetDisabledBadge>
        )}
      </SeatContainer>
    </SeatWrapper>
  );
};

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 4px rgba(197, 160, 89, 0.4); }
  50% { box-shadow: 0 0 14px rgba(197, 160, 89, 0.85); }
`;

const SeatWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
`;

const SpeechBubble = styled.div`
  position: absolute;
  top: -30px;
  background: ${THEME.gradients.obsidianButton};
  border: 1px solid ${THEME.gold};
  color: ${THEME.goldLight};
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: ${THEME.radius.full};
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 3px 10px rgba(9, 13, 22, 0.35);
  z-index: 200;
  pointer-events: none;
`;

const SeatContainer = styled.div<{
  $isCurrentTurn: boolean;
  $isTargetable: boolean;
  $isSelectedTarget: boolean;
  $isEliminated: boolean;
  $isProtected: boolean;
}>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  min-height: 40px;
  background: #ffffff;
  background-image: ${THEME.gradients.marbleSlab};
  border: 1.5px solid ${THEME.border};
  border-radius: ${THEME.radius.lg};
  box-shadow: 0 2px 8px rgba(9, 13, 22, 0.05);
  transition: all 0.2s ease;
  cursor: ${props => (props.$isTargetable ? 'pointer' : 'default')};

  ${props =>
    props.$isCurrentTurn &&
    css`
      border-color: ${THEME.gold};
      background: linear-gradient(135deg, #ffffff 0%, #fefce8 100%);
      box-shadow: 0 0 12px rgba(197, 160, 89, 0.4), 0 2px 8px rgba(9, 13, 22, 0.08);
    `}

  ${props =>
    props.$isTargetable &&
    css`
      border-color: ${THEME.gold};
      animation: ${pulseGlow} 1.6s infinite ease-in-out;
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    `}

  ${props =>
    props.$isSelectedTarget &&
    css`
      border-color: ${THEME.burgundy};
      background: #fff1f2;
      box-shadow: 0 0 16px rgba(99, 19, 38, 0.4);
    `}

  ${props =>
    props.$isEliminated &&
    css`
      opacity: 0.45;
      filter: grayscale(90%);
      background: #f1f5f9;
      border-color: #cbd5e1;
    `}

  @media (max-width: 360px) {
    padding: 3px 6px;
    gap: 4px;
  }
`;

const AvatarRing = styled.div<{
  $isCurrentTurn: boolean;
  $isProtected: boolean;
  $isSpeaking: boolean;
  $isTargetable: boolean;
}>`
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: ${THEME.primary};
  border: 1.5px solid ${props => (props.$isCurrentTurn ? THEME.gold : THEME.border)};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  flex-shrink: 0;

  ${props =>
    props.$isSpeaking &&
    css`
      box-shadow: 0 0 0 2.5px ${THEME.emerald}, 0 0 8px ${THEME.emeraldGlow};
      border-color: ${THEME.emerald};
    `}
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
`;

const AvatarIcon = styled.span`
  font-size: 15px;
  line-height: 1;
`;

const ProtectionBadge = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 11px;
  line-height: 1;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
`;

const EliminatedBadge = styled.span`
  position: absolute;
  bottom: -4px;
  right: -4px;
  font-size: 11px;
  line-height: 1;
`;

const InfoBlock = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 48px;
  max-width: 80px;

  @media (max-width: 360px) {
    min-width: 40px;
    max-width: 65px;
  }
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
`;

const PlayerName = styled.span`
  font-size: 10.5px;
  font-weight: 800;
  color: ${THEME.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const BotTag = styled.span`
  font-size: 8px;
  font-weight: 800;
  background: #e2e8f0;
  color: ${THEME.mutedForeground};
  padding: 1px 3px;
  border-radius: 3px;
`;

const SelfTag = styled.span`
  font-size: 8px;
  font-weight: 800;
  background: ${THEME.goldLight};
  color: ${THEME.primary};
  padding: 1px 3px;
  border-radius: 3px;
`;

const StatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
  font-weight: 700;
`;

const TokenScore = styled.span`
  color: ${THEME.burgundy};
`;

const HandCount = styled.span`
  color: ${THEME.mutedForeground};
`;

const DiscardStackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 2px;
  background: #f8fafc;
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.sm};
  padding: 1px 4px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

  &:hover {
    border-color: ${THEME.gold};
    background: #ffffff;
  }
`;

const DiscardMiniCard = styled.span`
  width: 14px;
  height: 18px;
  border-radius: 2px;
  background: ${THEME.gradients.obsidianButton};
  color: ${THEME.goldLight};
  font-family: ${THEME.font.serif};
  font-weight: 800;
  font-size: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0.5px solid ${THEME.gold};
`;

const DiscardCount = styled.span`
  font-size: 9px;
  font-weight: 700;
  color: ${THEME.mutedForeground};
`;

const TargetPromptBadge = styled.span`
  font-size: 9px;
  font-weight: 800;
  color: #ffffff;
  background: ${THEME.gradients.obsidianButton};
  border: 1px solid ${THEME.gold};
  padding: 2px 5px;
  border-radius: ${THEME.radius.full};
  white-space: nowrap;
`;

const TargetDisabledBadge = styled.span`
  font-size: 8.5px;
  font-weight: 700;
  color: ${THEME.mutedForeground};
  background: #e2e8f0;
  padding: 1px 4px;
  border-radius: ${THEME.radius.sm};
  white-space: nowrap;
`;
