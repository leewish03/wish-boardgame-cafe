import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { CardInstance, CardValue } from '../../../../packages/love-letter-core/src/types';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { getHeraldicIcon } from '../presentation/heraldicIcons';

interface PriestSecretModalProps {
  isOpen: boolean;
  targetPlayerName: string;
  secretCard: CardInstance | null;
  onClose: () => void;
}

export const PriestSecretModal: React.FC<PriestSecretModalProps> = ({
  isOpen,
  targetPlayerName,
  secretCard,
  onClose,
}) => {
  if (!secretCard) return null;
  const meta = CARD_DEFINITIONS[secretCard.value as CardValue] || { name: secretCard.name, description: '' };

  return (
    <AnimatePresence>
      {isOpen && (
        <Overlay
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <SecretCardBox
            as={motion.div}
            initial={{ scale: 0.5, rotateY: 90 }}
            animate={{ scale: 1, rotateY: 0 }}
            exit={{ scale: 0.5, rotateY: 90 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <HeaderTitle>🔮 사제의 은밀한 손패 투시</HeaderTitle>
            <Subtitle>[{targetPlayerName}] 님의 손패를 확인했습니다</Subtitle>

            <CardFrame>
              <EmblemWrapper>{getHeraldicIcon(secretCard.value, 48)}</EmblemWrapper>
              <CardValueBig>{secretCard.value}</CardValueBig>
              <CardNameBig>{secretCard.name}</CardNameBig>
              <CardDescBig>{meta.description}</CardDescBig>
            </CardFrame>

            <ConfirmBtn onClick={onClose}>확인 완료 (닫기)</ConfirmBtn>
          </SecretCardBox>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const SecretCardBox = styled.div`
  width: 100%;
  max-width: 320px;
  background: #18181b;
  border: 2px solid #d4af37;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  box-shadow: 0 0 35px rgba(212, 175, 55, 0.4);
`;

const HeaderTitle = styled.h3`
  margin: 0 0 4px;
  font-size: 15px;
  color: #fef08a;
  font-weight: 800;
`;

const Subtitle = styled.p`
  margin: 0 0 16px;
  font-size: 11px;
  color: #a1a1aa;
`;

const CardFrame = styled.div`
  background: radial-gradient(circle at 50% 30%, #ffffff 0%, #f7f4ed 100%);
  border: 1.5px solid #d4af37;
  border-radius: 12px;
  padding: 16px;
  color: #18181b;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  margin-bottom: 20px;
`;

const EmblemWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
`;

const CardValueBig = styled.div`
  font-family: 'Cinzel', serif;
  font-size: 28px;
  font-weight: 800;
  color: #d4af37;
`;

const CardNameBig = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: #18181b;
  margin: 2px 0 6px;
`;

const CardDescBig = styled.p`
  margin: 0;
  font-size: 10px;
  color: #4b5563;
  line-height: 1.35;
`;

const ConfirmBtn = styled.button`
  width: 100%;
  padding: 12px;
  background: #d4af37;
  color: #18181b;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
`;
