import React from 'react';
import styled, { css } from 'styled-components';
import { THEME } from '../../../shared/theme';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MessageSquare,
  Menu,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface GameHudProps {
  roundNumber: number;
  myTokens: number;
  targetTokens: number;
  turnPlayerNickname: string;
  isMyTurn: boolean;
  isConnected?: boolean;
  onOpenSettings: () => void;
  onToggleMic?: () => void;
  onToggleSpeaker?: () => void;
  onToggleSTT?: () => void;
  isMicOn?: boolean;
  isSpeakerOn?: boolean;
  isSTTActive?: boolean;
}

export const GameHud: React.FC<GameHudProps> = ({
  roundNumber,
  myTokens,
  targetTokens,
  turnPlayerNickname,
  isMyTurn,
  isConnected = true,
  onOpenSettings,
  onToggleMic,
  onToggleSpeaker,
  onToggleSTT,
  isMicOn = false,
  isSpeakerOn = true,
  isSTTActive = false,
}) => {
  return (
    <HudContainer>
      {/* Left: Brand Logo & Round & Token Counter */}
      <LeftCluster>
        <BrandLogo>
          <span className="logo-seal">💌</span>
          <span className="salon-text">LOVE LETTER</span>
        </BrandLogo>
        <RoundBadge>R{roundNumber}</RoundBadge>
        <TokenTally title={`호감도 토큰 (${myTokens}/${targetTokens})`}>
          {Array.from({ length: targetTokens }).map((_, i) => (
            <TokenStamp key={i} $earned={i < myTokens}>
              {i < myTokens ? '♥' : '○'}
            </TokenStamp>
          ))}
        </TokenTally>
      </LeftCluster>

      {/* Center: Turn Status Banner */}
      <CenterTurnBanner $isMyTurn={isMyTurn}>
        {isMyTurn ? (
          <>
            <Sparkles size={13} color={THEME.burgundy} />
            <span>나의 턴</span>
          </>
        ) : (
          <span>{turnPlayerNickname} 님의 턴</span>
        )}
      </CenterTurnBanner>

      {/* Right: Media & Menu Actions */}
      <RightCluster>
        <ConnectionIndicator $connected={isConnected} title={isConnected ? '실시간 연결됨' : '연결 끊김'}>
          <span className="dot" />
        </ConnectionIndicator>

        {onToggleMic && (
          <IconButton
            onClick={onToggleMic}
            $active={isMicOn}
            title={isMicOn ? '마이크 끄기' : '마이크 켜기'}
          >
            {isMicOn ? <Mic size={15} color={THEME.emerald} /> : <MicOff size={15} color={THEME.mutedForeground} />}
          </IconButton>
        )}

        {onToggleSpeaker && (
          <IconButton
            onClick={onToggleSpeaker}
            $active={isSpeakerOn}
            title={isSpeakerOn ? '스피커 끄기' : '스피커 켜기'}
          >
            {isSpeakerOn ? <Volume2 size={15} color={THEME.primary} /> : <VolumeX size={15} color={THEME.mutedForeground} />}
          </IconButton>
        )}

        {onToggleSTT && (
          <IconButton
            onClick={onToggleSTT}
            $active={isSTTActive}
            title={isSTTActive ? '음성 자막 끄기' : '실시간 음성 자막(STT) 켜기'}
          >
            <MessageSquare size={15} color={isSTTActive ? THEME.gold : THEME.mutedForeground} />
          </IconButton>
        )}

        <IconButton onClick={onOpenSettings} title="게임 메뉴 / 규칙 / 나가기">
          <Menu size={16} color={THEME.primary} />
        </IconButton>
      </RightCluster>
    </HudContainer>
  );
};

const HudContainer = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 44px;
  min-height: 44px;
  max-height: 44px;
  padding: 0 10px;
  background-color: rgba(255, 255, 255, 0.96);
  background-image: ${THEME.gradients.marbleSlab};
  border-bottom: 1.5px solid ${THEME.border};
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 8px rgba(9, 13, 22, 0.04);
  z-index: 100;
  box-sizing: border-box;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, ${THEME.gold} 50%, transparent 100%);
  }
`;

const LeftCluster = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const BrandLogo = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: ${THEME.font.serif};
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: ${THEME.foreground};
  text-transform: uppercase;

  span.logo-seal {
    font-size: 14px;
    line-height: 1;
  }

  span.salon-text {
    color: ${THEME.burgundy};
    font-weight: 800;
    display: none;
    @media (min-width: 400px) {
      display: inline;
    }
  }
`;

const RoundBadge = styled.span`
  font-family: ${THEME.font.serif};
  font-size: 10.5px;
  font-weight: 800;
  background: ${THEME.gradients.obsidianButton};
  color: ${THEME.goldLight};
  padding: 2px 6px;
  border-radius: ${THEME.radius.sm};
  border: 1px solid ${THEME.gold};
  letter-spacing: 0.05em;
`;

const TokenTally = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5px;
`;

const TokenStamp = styled.span<{ $earned: boolean }>`
  font-size: 12px;
  line-height: 1;
  color: ${props => (props.$earned ? THEME.burgundy : '#cbd5e1')};
  filter: ${props => (props.$earned ? 'drop-shadow(0 1px 2px rgba(99, 19, 38, 0.3))' : 'none')};
  transition: all 0.2s ease;
`;

const CenterTurnBanner = styled.div<{ $isMyTurn: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 800;
  font-family: ${props => (props.$isMyTurn ? THEME.font.serif : THEME.font.sans)};
  padding: 3px 10px;
  border-radius: ${THEME.radius.full};
  white-space: nowrap;
  letter-spacing: ${props => (props.$isMyTurn ? '0.04em' : 'normal')};
  transition: all 0.25s ease;

  ${props =>
    props.$isMyTurn
      ? css`
          background: ${THEME.gradients.goldShimmer};
          color: ${THEME.foreground};
          border: 1px solid ${THEME.goldAntique};
          box-shadow: 0 2px 8px rgba(197, 160, 89, 0.35);
        `
      : css`
          background: rgba(241, 245, 249, 0.85);
          color: ${THEME.mutedForeground};
          border: 1px solid ${THEME.border};
        `}

  @media (max-width: 360px) {
    font-size: 10.5px;
    padding: 2px 8px;
  }
`;

const RightCluster = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ConnectionIndicator = styled.div<{ $connected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;

  span.dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: ${props => (props.$connected ? THEME.emerald : THEME.destructive)};
    box-shadow: 0 0 4px ${props => (props.$connected ? THEME.emeraldGlow : 'rgba(239, 68, 68, 0.4)')};
  }
`;

const IconButton = styled.button<{ $active?: boolean }>`
  background: ${props => (props.$active ? 'rgba(197, 160, 89, 0.15)' : '#ffffff')};
  border: 1px solid ${props => (props.$active ? THEME.gold : THEME.border)};
  width: 28px;
  height: 28px;
  border-radius: ${THEME.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition: all 0.15s ease;
  padding: 0;

  &:hover {
    border-color: ${THEME.gold};
    background-color: ${THEME.secondary};
  }

  &:active {
    transform: scale(0.95);
  }
`;
