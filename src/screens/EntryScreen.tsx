import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

interface EntryScreenProps {
  onLogin: (nickname: string, avatar: string) => void;
}

const AVATARS = ['👑', '🎩', '🌹', '⚔️', '🪞', '🦁', '🦊', '🐼'];

export const EntryScreen: React.FC<EntryScreenProps> = ({ onLogin }) => {
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('👑');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    onLogin(nickname.trim(), selectedAvatar);
  };

  return (
    <EntryContainer>
      <SalonCard as={motion.div} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <SalonTitle>WISH BOARDGAME SALON</SalonTitle>
        <SalonSubtitle>Private VIP Boardgame Lounge</SalonSubtitle>

        <AvatarSelection>
          {AVATARS.map(av => (
            <AvatarBtn
              key={av}
              type="button"
              $isSelected={selectedAvatar === av}
              onClick={() => setSelectedAvatar(av)}
            >
              {av}
            </AvatarBtn>
          ))}
        </AvatarSelection>

        <LoginForm onSubmit={handleSubmit}>
          <NicknameInput
            type="text"
            placeholder="살롱에서 사용할 닉네임"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={12}
            autoFocus
          />
          <EnterButton type="submit" disabled={!nickname.trim()}>
            살롱 입장하기
          </EnterButton>
        </LoginForm>
      </SalonCard>
    </EntryContainer>
  );
};

const EntryContainer = styled.div`
  width: 100vw;
  height: 100dvh;
  background: radial-gradient(circle at 50% 40%, #18181b 0%, #09090b 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const SalonCard = styled.div`
  width: 100%;
  max-width: 400px;
  background: #18181b;
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 16px 40px rgba(0,0,0,0.6);
`;

const SalonTitle = styled.h1`
  font-family: 'Cinzel', serif;
  font-size: 20px;
  font-weight: 700;
  color: #d4af37;
  letter-spacing: 1px;
  margin: 0;
`;

const SalonSubtitle = styled.p`
  font-size: 11px;
  color: #a1a1aa;
  margin: 4px 0 24px;
  letter-spacing: 0.5px;
`;

const AvatarSelection = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
`;

const AvatarBtn = styled.button<{ $isSelected: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${props => props.$isSelected ? 'rgba(212, 175, 55, 0.2)' : '#27272a'};
  border: 2px solid ${props => props.$isSelected ? '#d4af37' : 'transparent'};
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LoginForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const NicknameInput = styled.input`
  background: #27272a;
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  color: #fff;
  font-size: 14px;
  text-align: center;
  outline: none;
  &:focus {
    border-color: #d4af37;
  }
`;

const EnterButton = styled.button`
  background: linear-gradient(135deg, #d4af37 0%, #aa820a 100%);
  border: none;
  border-radius: 8px;
  padding: 12px;
  color: #18181b;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
