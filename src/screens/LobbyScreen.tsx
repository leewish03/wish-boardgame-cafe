import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

interface LobbyScreenProps {
  user: { nickname: string; avatar: string };
  onCreateRoom: (gameType: string) => void;
  onJoinRoom: (roomCode: string) => void;
  onLogout: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  user,
  onCreateRoom,
  onJoinRoom,
  onLogout,
}) => {
  const [joinCode, setJoinCode] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim().length === 6) {
      onJoinRoom(joinCode.trim().toUpperCase());
    }
  };

  return (
    <LobbyContainer>
      <LobbyNav>
        <LogoBlock>
          <LogoText>WISH SALON</LogoText>
        </LogoBlock>
        <UserProfile>
          <UserAvatar>{user.avatar}</UserAvatar>
          <UserNick>{user.nickname}</UserNick>
          <LogoutBtn onClick={onLogout}>로그아웃</LogoutBtn>
        </UserProfile>
      </LobbyNav>

      <ContentArea>
        <GamesGrid>
          {/* Main Game: Love Letter */}
          <GameCard as={motion.div} whileHover={{ y: -4 }}>
            <GameBanner>
              <GameBadge>LIVE NOW</GameBadge>
              <GameEmblem>💌</GameEmblem>
            </GameBanner>
            <GameInfo>
              <GameTitle>러브레터 (Love Letter)</GameTitle>
              <GameDesc>단 16장의 카드로 펼치는 황실의 심리 추리 대결 (2~6인)</GameDesc>
              <ButtonGroup>
                <ActionButton $primary onClick={() => onCreateRoom('LOVE_LETTER')}>
                  방 만들기
                </ActionButton>
              </ButtonGroup>
            </GameInfo>
          </GameCard>

          {/* Up Next: Dalmuti */}
          <GameCard $disabled>
            <GameBanner $gray>
              <GameBadge $comingSoon>COMING SOON</GameBadge>
              <GameEmblem>👑</GameEmblem>
            </GameBanner>
            <GameInfo>
              <GameTitle>위대한 달무티</GameTitle>
              <GameDesc>인생역전 계급 타파 카드게임 (준비 중)</GameDesc>
            </GameInfo>
          </GameCard>
        </GamesGrid>

        <JoinBox onSubmit={handleJoin}>
          <JoinTitle>참여 코드로 바로 입장</JoinTitle>
          <JoinRow>
            <JoinInput
              type="text"
              placeholder="6자리 코드 (예: AB12CD)"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <JoinSubmit type="submit" disabled={joinCode.trim().length !== 6}>
              입장
            </JoinSubmit>
          </JoinRow>
        </JoinBox>
      </ContentArea>
    </LobbyContainer>
  );
};

const LobbyContainer = styled.div`
  width: 100vw;
  height: 100dvh;
  background: #09090b;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`;

const LobbyNav = styled.header`
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #18181b;
  border-bottom: 1px solid rgba(212, 175, 55, 0.3);
`;

const LogoBlock = styled.div`
  display: flex;
  align-items: center;
`;

const LogoText = styled.span`
  font-family: 'Cinzel', serif;
  font-weight: 800;
  font-size: 16px;
  color: #d4af37;
  letter-spacing: 1px;
`;

const UserProfile = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const UserAvatar = styled.span`
  font-size: 20px;
`;

const UserNick = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #f4f4f5;
`;

const LogoutBtn = styled.button`
  background: transparent;
  border: 1px solid #3f3f46;
  color: #a1a1aa;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  &:hover {
    color: #fff;
  }
`;

const ContentArea = styled.main`
  flex: 1;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const GamesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
`;

const GameCard = styled.div<{ $disabled?: boolean }>`
  background: #18181b;
  border: 1px solid ${props => props.$disabled ? '#27272a' : 'rgba(212, 175, 55, 0.3)'};
  border-radius: 12px;
  overflow: hidden;
  opacity: ${props => props.$disabled ? 0.6 : 1};
`;

const GameBanner = styled.div<{ $gray?: boolean }>`
  height: 100px;
  background: ${props => props.$gray ? '#27272a' : 'radial-gradient(circle at 50% 50%, #831843 0%, #4c0519 100%)'};
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const GameBadge = styled.span<{ $comingSoon?: boolean }>`
  position: absolute;
  top: 8px;
  left: 8px;
  background: ${props => props.$comingSoon ? '#3f3f46' : '#d4af37'};
  color: #18181b;
  font-size: 9px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
`;

const GameEmblem = styled.span`
  font-size: 40px;
`;

const GameInfo = styled.div`
  padding: 16px;
`;

const GameTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 700;
  color: #f4f4f5;
`;

const GameDesc = styled.p`
  margin: 0 0 16px;
  font-size: 12px;
  color: #a1a1aa;
  line-height: 1.4;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button<{ $primary?: boolean }>`
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  background: ${props => props.$primary ? '#d4af37' : '#27272a'};
  color: ${props => props.$primary ? '#18181b' : '#fff'};
`;

const JoinBox = styled.form`
  background: #18181b;
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 12px;
  padding: 20px;
`;

const JoinTitle = styled.h4`
  margin: 0 0 12px;
  font-size: 13px;
  color: #d4af37;
`;

const JoinRow = styled.div`
  display: flex;
  gap: 8px;
`;

const JoinInput = styled.input`
  flex: 1;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  padding: 10px 14px;
  color: #fff;
  font-size: 14px;
  letter-spacing: 2px;
  outline: none;
  &:focus {
    border-color: #d4af37;
  }
`;

const JoinSubmit = styled.button`
  padding: 0 20px;
  background: #d4af37;
  color: #18181b;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
