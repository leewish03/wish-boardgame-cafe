import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, X } from 'lucide-react';
import { CardInstance, CardValue } from '../../../../packages/love-letter-core/src/types';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { getHeraldicIcon } from '../presentation/heraldicIcons';
import { THEME } from '../../../shared/theme';

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
            initial={{ scale: 0.9, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 15 }}
            onClick={e => e.stopPropagation()}
          >
            <HeaderRow>
              <ModalTitle>
                <ScrollText size={16} aria-hidden="true" /> <strong>[{playerName}]</strong> 사용한 카드 히스토리 ({discardPile.length}장)
              </ModalTitle>
              <CloseBtn onClick={onClose} aria-label="히스토리 닫기"><X size={14} /></CloseBtn>
            </HeaderRow>

            {discardPile.length === 0 ? (
              <EmptyMessage>아직 사용하거나 버린 카드가 없습니다.</EmptyMessage>
            ) : (
              <CardList>
                {discardPile.map((card, idx) => {
                  const meta = CARD_DEFINITIONS[card.value as CardValue] || { name: card.name, description: '' };
                  return (
                    <CardRow key={card.id || idx}>
                      <ValueBadge>{card.value}</ValueBadge>
                      <EmblemBox>{getHeraldicIcon(card.value, 20)}</EmblemBox>
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
  background: rgba(9, 13, 22, 0.7);
  backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const ModalBox = styled.div`
  width: 100%;
  max-width: 420px;
  max-height: 75vh;
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleSlab};
  border: 1.5px solid ${THEME.gold};
  border-radius: ${THEME.radius.xl};
  padding: 18px;
  box-shadow: 0 16px 40px rgba(9, 13, 22, 0.3);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  border-bottom: 1px solid ${THEME.border};
  padding-bottom: 8px;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  color: ${THEME.foreground};
  display: flex;
  align-items: center;
  gap: 5px;

  strong {
    color: ${THEME.burgundy};
  }
`;

const CloseBtn = styled.button`
  background: #f1f5f9;
  border: 1px solid ${THEME.border};
  color: ${THEME.mutedForeground};
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;

  &:hover {
    background: #e2e8f0;
    color: ${THEME.foreground};
  }
`;

const EmptyMessage = styled.p`
  margin: 24px 0;
  font-size: 12px;
  color: ${THEME.mutedForeground};
  text-align: center;
`;

const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  max-height: 50vh;
  padding-right: 4px;
`;

const CardRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #f8fafc;
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.md};
`;

const ValueBadge = styled.div`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: ${THEME.primary};
  color: ${THEME.goldLight};
  font-family: ${THEME.font.serif};
  font-weight: 900;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${THEME.gold};
  flex-shrink: 0;
`;

const EmblemBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const CardInfo = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const CardName = styled.span`
  font-size: 11.5px;
  font-weight: 800;
  color: ${THEME.foreground};
`;

const CardDesc = styled.span`
  font-size: 10px;
  color: ${THEME.mutedForeground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
