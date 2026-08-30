import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { CardInstance, CardValue } from '../../../../packages/love-letter-core/src/types';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { getHeraldicIcon } from '../presentation/heraldicIcons';

interface DiscardHistoryModalProps {
  isOpen: boolean;
  playerName: string;
  discardPile: CardInstance[];
  onClose: () => void;
}

export const DiscardHistoryModal: React.FC<DiscardHistoryModalProps> = ({
  isOpen,
  playerName,
  discardPile,
  onClose,
}) => {
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
          <ModalBox
            as={motion.div}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <HeaderRow>
              <ModalTitle>📜 [{playerName}] 님의 사용한 카드 히스토리 ({discardPile.length}장)</ModalTitle>
              <CloseBtn onClick={onClose}>✕</CloseBtn>
            </HeaderRow>

            {discardPile.length === 0 ? (
              <EmptyMessage>아직 사용하거나 버린 카드가 없습니다.</EmptyMessage>
            ) : (
              <CardList>
                {discardPile.map((card, idx) => {
                  const meta = CARD_DEFINITIONS[card.value as CardValue] || { name: card.name, description: '' };
                  return (
                    <CardRow key={card.id || idx}>
                      <EmblemBox>{getHeraldicIcon(card.value, 20)}</EmblemBox>
                      <ValueBadge>{card.value}</ValueBadge>
                      <CardInfo>
                        <CardName>{card.name}</CardName>
                        <CardDesc>{meta.description}</CardDesc>
                      </CardInfo>
                    </CardRow>
                  );
                })}
              </CardList>
            )}
          </ModalBox>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const ModalBox = styled.div`
  width: 100%;
  max-width: 440px;
  max-height: 80vh;
  background: #18181b;
  border: 1.5px solid #d4af37;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.3);
  padding-bottom: 10px;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #fef08a;
`;

const CloseBtn = styled.button`
  background: transparent;
  border: none;
  color: #a1a1aa;
  font-size: 18px;
  cursor: pointer;
  &:hover {
    color: #fff;
  }
`;

const EmptyMessage = styled.p`
  color: #71717a;
  font-size: 13px;
  text-align: center;
  padding: 24px 0;
`;

const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
`;

const CardRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
`;

const EmblemBox = styled.div`
  display: flex;
  align-items: center;
`;

const ValueBadge = styled.span`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #27272a;
  border: 1px solid #d4af37;
  color: #d4af37;
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CardInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const CardName = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: #fff;
`;

const CardDesc = styled.span`
  font-size: 10px;
  color: #a1a1aa;
  line-height: 1.3;
`;
