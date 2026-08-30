import React from 'react';
import styled from 'styled-components';

interface GameHudProps {
  roundNumber: number;
  myTokens: number;
  targetTokens: number;
  turnPlayerNickname: string;
  isMyTurn: boolean;
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
      <LeftCluster>
        <GameTitle>💌 러브레터</GameTitle>
        <RoundBadge>R{roundNumber}</RoundBadge>
        <TokenTally>
          {Array.from({ length: targetTokens }).map((_, i) => (
            <TokenIcon key={i} $earned={i < myTokens}>♥</TokenIcon>
          ))}
        </TokenTally>
      </LeftCluster>

      <CenterTurnBanner $isMyTurn={isMyTurn}>
        {isMyTurn ? '👑 나의 턴' : `${turnPlayerNickname} 님의 턴`}
      </CenterTurnBanner>

      <RightCluster>
        {onToggleMic && (
          <IconButton onClick={onToggleMic} $active={isMicOn} title={isMicOn ? '마이크 끄기' : '마이크 켜기'}>
            {isMicOn ? '🎙️' : '🔇'}
          </IconButton>
        )}
        {onToggleSpeaker && (
          <IconButton onClick={onToggleSpeaker} $active={isSpeakerOn} title={isSpeakerOn ? '스피커 음소거' : '스피커 켜기'}>
            {isSpeakerOn ? '🔊' : '🔈'}
          </IconButton>
        )}
        {onToggleSTT && (
          <IconButton onClick={onToggleSTT} $active={isSTTActive} title="실시간 자막(STT)">
            💬
          </IconButton>
        )}
        <IconButton onClick={onOpenSettings} title="메뉴 / 나가기">☰</IconButton>
      </RightCluster>
    </HudContainer>
  );
};

const HudContainer = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 48px;
  padding: 0 16px;
  background: rgba(18, 18, 20, 0.95);
  border-bottom: 1px solid rgba(212, 175, 55, 0.3);
  color: #fff;
  z-index: 100;
`;

const LeftCluster = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const GameTitle = styled.span`
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 13px;
  color: #d4af37;
  white-space: nowrap;
`;

const RoundBadge = styled.span`
  font-size: 11px;
  background: #27272a;
  color: #a1a1aa;
  padding: 2px 6px;
  border-radius: 4px;
`;

const TokenTally = styled.div`
  display: flex;
  gap: 2px;
`;

const TokenIcon = styled.span<{ $earned: boolean }>`
  font-size: 12px;
  color: ${props => props.$earned ? '#e11d48' : '#3f3f46'};
`;

const CenterTurnBanner = styled.div<{ $isMyTurn: boolean }>`
  font-size: 12px;
  font-weight: 700;
  color: ${props => props.$isMyTurn ? '#fef08a' : '#d4d4d8'};
  padding: 2px 10px;
  border-radius: 12px;
  background: ${props => props.$isMyTurn ? 'rgba(212, 175, 55, 0.2)' : 'transparent'};
  border: 1px solid ${props => props.$isMyTurn ? '#d4af37' : 'transparent'};
  white-space: nowrap;
`;

const RightCluster = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const IconButton = styled.button<{ $active?: boolean }>`
  background: ${props => props.$active ? 'rgba(212, 175, 55, 0.25)' : '#27272a'};
  border: 1px solid ${props => props.$active ? '#d4af37' : 'rgba(255, 255, 255, 0.1)'};
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
`;
