import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye } from 'lucide-react';
import { CardInstance, CardValue } from '../../../../packages/love-letter-core/src/types';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { getHeraldicIcon } from '../presentation/heraldicIcons';
import { THEME } from '../../../shared/theme';

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
            initial={{ scale: 0.7, rotateY: 90 }}
            animate={{ scale: 1, rotateY: 0 }}
            exit={{ scale: 0.7, rotateY: 90 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            onClick={e => e.stopPropagation()}
          >
            <HeaderTitle><Eye size={18} aria-hidden="true" /> 사제의 은밀한 손패 투시</HeaderTitle>
            <Subtitle>
              <strong>[{targetPlayerName}]</strong> 님의 손패를 당신만 확인했습니다
            </Subtitle>

            <CardFrame>
              <EmblemWrapper>{getHeraldicIcon(secretCard.value, 44)}</EmblemWrapper>
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
  background: rgba(9, 13, 22, 0.75);
  backdrop-filter: blur(8px);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const SecretCardBox = styled.div`
  width: 100%;
  max-width: 320px;
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleSlab};
  border: 2px solid ${THEME.gold};
  border-radius: ${THEME.radius.xl};
  padding: 22px 18px;
  text-align: center;
  box-shadow: 0 16px 40px rgba(9, 13, 22, 0.35), 0 0 24px rgba(197, 160, 89, 0.4);
`;

const HeaderTitle = styled.h3`
  margin: 0 0 4px;
  font-size: 15px;
  color: ${THEME.foreground};
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: ${THEME.font.serif};
  font-weight: 800;
`;

const Subtitle = styled.p`
  margin: 0 0 16px;
  font-size: 11.5px;
  color: ${THEME.mutedForeground};

  strong {
    color: ${THEME.burgundy};
  }
`;

const CardFrame = styled.div`
  background: radial-gradient(circle at 50% 30%, #ffffff 0%, #f8fafc 100%);
  border: 1.5px solid ${THEME.gold};
  border-radius: ${THEME.radius.lg};
  padding: 16px;
  margin-bottom: 18px;
  box-shadow: inset 0 0 0 1px rgba(197, 160, 89, 0.3), 0 4px 14px rgba(9, 13, 22, 0.08);
`;

const EmblemWrapper = styled.div`
  margin-bottom: 8px;
`;

const CardValueBig = styled.div`
  font-family: ${THEME.font.serif};
  font-size: 26px;
  font-weight: 900;
  color: ${THEME.primary};
  line-height: 1;
`;

const CardNameBig = styled.div`
  font-size: 14px;
  font-weight: 800;
  color: ${THEME.foreground};
  margin: 4px 0 8px;
`;

const CardDescBig = styled.p`
  margin: 0;
  font-size: 10.5px;
  color: ${THEME.mutedForeground};
  line-height: 1.4;
`;

const ConfirmBtn = styled.button`
  width: 100%;
  height: 40px;
  background: ${THEME.gradients.obsidianButton};
  color: ${THEME.goldLight};
  font-family: ${THEME.font.serif};
  font-weight: 800;
  font-size: 13px;
  border: 1px solid ${THEME.gold};
  border-radius: ${THEME.radius.md};
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(9, 13, 22, 0.25);
  transition: all 0.15s ease;

  &:hover {
    filter: brightness(1.1);
    box-shadow: 0 6px 16px rgba(197, 160, 89, 0.4);
  }

  &:active {
    transform: scale(0.98);
  }
`;
