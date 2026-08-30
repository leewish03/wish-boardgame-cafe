import React from 'react';
import styled, { css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerPublic, CardInstance } from '../../../../packages/love-letter-core/src/types';

interface PlayerSeatProps {
  player: PlayerPublic;
  isCurrentTurn: boolean;
  isTargetable: boolean;
  isSelectedTarget: boolean;
  isSelf: boolean;
  isSpeaking?: boolean;
  subtitle?: { text: string; timestamp: number } | null;
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
  onClickTarget,
  onInspectDiscards,
}) => {
  return (
    <SeatWrapper>
      {/* Real-time STT Speech Bubble */}
      <AnimatePresence>
        {subtitle && subtitle.text && (
          <SpeechBubble
            as={motion.div}
            initial={{ opacity: 0, y: 10, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.85 }}
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
        onClick={isTargetable ? onClickTarget : undefined}
        whileHover={isTargetable ? { scale: 1.04 } : undefined}
        whileTap={isTargetable ? { scale: 0.96 } : undefined}
        data-player-id={player.id}
      >
        <AvatarRing
          $isCurrentTurn={isCurrentTurn}
          $isProtected={player.isProtected}
          $isSpeaking={isSpeaking}
        >
          <AvatarIcon>{player.avatar || '👑'}</AvatarIcon>
          {player.isProtected && <ProtectionBadge>🛡️</ProtectionBadge>}
          {player.isEliminated && <EliminatedBadge>☠️</EliminatedBadge>}
        </AvatarRing>

        <InfoBlock>
          <NameRow>
            <PlayerName>{player.nickname}</PlayerName>
            {player.isBot && <BotTag>AI</BotTag>}
            {isSelf && <SelfTag>ME</SelfTag>}
          </NameRow>

          <StatsRow>
            <TokenScore>⭐ {player.tokens}</TokenScore>
            <HandCount>🃏 {player.cardCount}</HandCount>
          </StatsRow>
        </InfoBlock>

        {player.discardPile && player.discardPile.length > 0 && (
          <DiscardStackButton onClick={onInspectDiscards} title="버린 카드 확인">
            <DiscardMiniCard>
              {player.discardPile[player.discardPile.length - 1].value}
            </DiscardMiniCard>
            <DiscardCount>+{player.discardPile.length}</DiscardCount>
          </DiscardStackButton>
        )}

        {isTargetable && (
          <TargetPromptBadge>🎯 지목</TargetPromptBadge>
        )}
      </SeatContainer>
    </SeatWrapper>
  );
};

const SeatWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const SpeechBubble = styled.div`
  position: absolute;
  top: -38px;
  background: rgba(18, 18, 20, 0.92);
  border: 1px solid #d4af37;
  color: #fef08a;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 12px;
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 4px 14px rgba(0,0,0,0.5);
  z-index: 200;
  pointer-events: none;
`;

const SeatContainer = styled.div<{
  $isCurrentTurn: boolean;
  $isTargetable: boolean;
  $isSelectedTarget: boolean;
  $isEliminated: boolean;
}>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(24, 24, 27, 0.85);
  border: 1.5px solid rgba(212, 175, 55, 0.25);
  border-radius: 12px;
  backdrop-filter: blur(8px);
  color: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
  cursor: ${props => props.$isTargetable ? 'pointer' : 'default'};

  ${props => props.$isCurrentTurn && css`
    border-color: #d4af37;
    box-shadow: 0 0 14px rgba(212, 175, 55, 0.4);
  `}

  ${props => props.$isTargetable && css`
    border-color: #f59e0b;
    box-shadow: 0 0 16px rgba(245, 158, 11, 0.5);
  `}

  ${props => props.$isSelectedTarget && css`
    border-color: #e11d48;
    box-shadow: 0 0 20px rgba(225, 29, 72, 0.6);
  `}

  ${props => props.$isEliminated && css`
    opacity: 0.4;
    filter: grayscale(100%);
  `}
`;

const AvatarRing = styled.div<{ $isCurrentTurn: boolean; $isProtected: boolean; $isSpeaking: boolean }>`
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #27272a;
  border: 2px solid ${props => props.$isCurrentTurn ? '#d4af37' : 'rgba(255, 255, 255, 0.2)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;

  ${props => props.$isSpeaking && css`
    box-shadow: 0 0 0 3px #10b981, 0 0 12px #10b981;
    border-color: #10b981;
  `}
`;

const AvatarIcon = styled.span`
  line-height: 1;
`;

const ProtectionBadge = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 12px;
`;

const EliminatedBadge = styled.span`
  position: absolute;
  bottom: -4px;
  right: -4px;
  font-size: 12px;
`;

const InfoBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const PlayerName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #f4f4f5;
  max-width: 68px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const BotTag = styled.span`
  font-size: 8px;
  background: rgba(212, 175, 55, 0.2);
  color: #d4af37;
  padding: 1px 3px;
  border-radius: 3px;
`;

const SelfTag = styled.span`
  font-size: 8px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  padding: 1px 3px;
  border-radius: 3px;
`;

const StatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #a1a1aa;
`;

const TokenScore = styled.span`
  color: #fbbf24;
  font-weight: 600;
`;

const HandCount = styled.span`
  color: #e4e4e7;
`;

const DiscardStackButton = styled.button`
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const DiscardMiniCard = styled.div`
  width: 16px;
  height: 22px;
  background: #fdfbf7;
  color: #18181b;
  border: 1px solid #d4af37;
  border-radius: 2px;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const DiscardCount = styled.span`
  font-size: 9px;
  color: #d4af37;
`;

const TargetPromptBadge = styled.div`
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #f59e0b;
  color: #18181b;
  font-size: 9px;
  font-weight: bold;
  padding: 1px 6px;
  border-radius: 10px;
  white-space: nowrap;
`;
