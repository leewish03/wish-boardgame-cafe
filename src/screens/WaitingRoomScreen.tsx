import React from 'react';
import styled from 'styled-components';

interface WaitingRoomScreenProps {
  roomCode: string;
  players: any[];
  isHost: boolean;
  myUserId: string;
  onAddBot: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export const WaitingRoomScreen: React.FC<WaitingRoomScreenProps> = ({
  roomCode,
  players,
  isHost,
  myUserId,
  onAddBot,
  onToggleReady,
  onStartGame,
  onLeaveRoom,
}) => {
  const me = players.find(p => p.id === myUserId);
  const canStart = isHost && players.length >= 2 && players.every(p => p.isReady || p.id === myUserId);

  return (
    <Container>
      <Header>
        <RoomCodeBadge>ROOM CODE: {roomCode}</RoomCodeBadge>
        <LeaveBtn onClick={onLeaveRoom}>나가기 🚪</LeaveBtn>
      </Header>

      <SeatsGrid>
        {players.map((p, idx) => (
          <SeatBox key={p.id || idx}>
            <SeatAvatar>{p.avatar || p.avatarUrl || '👑'}</SeatAvatar>
            <SeatNick>{p.nickname}</SeatNick>
            <SeatStatus $ready={p.isReady}>
              {p.isHost ? '방장' : p.isReady ? '준비 완료' : '대기 중'}
            </SeatStatus>
          </SeatBox>
        ))}

        {players.length < 6 && isHost && (
          <AddBotBox onClick={onAddBot}>
            <PlusIcon>🤖+</PlusIcon>
            <AddText>AI 봇 추가</AddText>
          </AddBotBox>
        )}
      </SeatsGrid>

      <FooterActions>
        {!isHost && (
          <ReadyBtn onClick={onToggleReady} $isReady={!!me?.isReady}>
            {me?.isReady ? '준비 해제' : '준비 완료'}
          </ReadyBtn>
        )}

        {isHost && (
          <StartBtn onClick={onStartGame} disabled={!canStart}>
            {players.length < 2 ? '최소 2인 필요' : '게임 시작'}
          </StartBtn>
        )}
      </FooterActions>
    </Container>
  );
};

const Container = styled.div`
  width: 100vw;
  height: 100dvh;
  background: #09090b;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const RoomCodeBadge = styled.span`
  font-family: 'Cinzel', serif;
  font-size: 16px;
  font-weight: 700;
  color: #d4af37;
  letter-spacing: 1px;
`;

const LeaveBtn = styled.button`
  background: transparent;
  border: 1px solid #3f3f46;
  color: #a1a1aa;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
`;

const SeatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
`;

const SeatBox = styled.div`
  background: #18181b;
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 12px;
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const SeatAvatar = styled.span`
  font-size: 28px;
`;

const SeatNick = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #fff;
`;

const SeatStatus = styled.span<{ $ready?: boolean }>`
  font-size: 10px;
  color: ${props => props.$ready ? '#4ade80' : '#a1a1aa'};
  font-weight: 600;
`;

const AddBotBox = styled.button`
  background: rgba(24, 24, 27, 0.5);
  border: 1.5px dashed rgba(212, 175, 55, 0.4);
  border-radius: 12px;
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  color: #d4af37;
  &:hover {
    background: rgba(212, 175, 55, 0.1);
  }
`;

const PlusIcon = styled.span`
  font-size: 20px;
`;

const AddText = styled.span`
  font-size: 11px;
  font-weight: 600;
`;

const FooterActions = styled.footer`
  max-width: 400px;
  width: 100%;
  margin: 0 auto;
`;

const ReadyBtn = styled.button<{ $isReady: boolean }>`
  width: 100%;
  padding: 14px;
  background: ${props => props.$isReady ? '#27272a' : '#d4af37'};
  color: ${props => props.$isReady ? '#f4f4f5' : '#18181b'};
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
`;

const StartBtn = styled.button`
  width: 100%;
  padding: 14px;
  background: #d4af37;
  color: #18181b;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
