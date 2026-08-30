import React from 'react';
import styled, { css } from 'styled-components';
import { motion } from 'framer-motion';
import { getHeraldicIcon } from '../presentation/heraldicIcons';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { CardValue } from '../../../../packages/love-letter-core/src/types';

interface GameCardProps {
  value: CardValue;
  name: string;
  id?: string;
  isSelected?: boolean;
  isDisabled?: boolean;
  isDragging?: boolean;
  disabledReason?: string;
  onClick?: () => void;
  onDragStart?: () => void;
  onDragEnd?: (e: any, info: any) => void;
  enableDrag?: boolean;
  compact?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({
  value,
  name,
  isSelected = false,
  isDisabled = false,
  disabledReason,
  onClick,
  onDragStart,
  onDragEnd,
  enableDrag = false,
  compact = false,
}) => {
  const meta = CARD_DEFINITIONS[value] || {
    value,
    name,
    nameEn: '',
    description: '',
  };

  return (
    <CardContainer
      as={motion.div}
      $isSelected={isSelected}
      $isDisabled={isDisabled}
      $compact={compact}
      onClick={!isDisabled ? onClick : undefined}
      drag={enableDrag && !isDisabled ? 'y' : false}
      dragConstraints={{ top: -160, bottom: 0 }}
      dragElastic={0.2}
      dragSnapToOrigin
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileDrag={{
        scale: 1.03,
        y: -8,
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 24px rgba(212, 175, 55, 0.65)',
        zIndex: 100,
      }}
      whileHover={!isDisabled ? { y: -6, scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      layout
    >
      <CardBorder>
        <CardHeader>
          <ValueBadge>{value}</ValueBadge>
          <NameBlock>
            <CardTitle>{name}</CardTitle>
            <CardSub>{meta.nameEn}</CardSub>
          </NameBlock>
        </CardHeader>

        <EmblemArea>
          {getHeraldicIcon(value, compact ? 22 : 36)}
        </EmblemArea>

        {!compact && (
          <DescriptionArea>
            <DescText>{meta.description}</DescText>
          </DescriptionArea>
        )}

        {isDisabled && disabledReason && (
          <DisabledBadge>{disabledReason}</DisabledBadge>
        )}
      </CardBorder>
    </CardContainer>
  );
};

const CardContainer = styled.div<{ $isSelected: boolean; $isDisabled: boolean; $compact: boolean }>`
  position: relative;
  width: ${props => props.$compact ? '64px' : '124px'};
  height: ${props => props.$compact ? '96px' : '184px'};
  background: #fdfbf7;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(212, 175, 55, 0.4);
  cursor: ${props => props.$isDisabled ? 'not-allowed' : 'pointer'};
  user-select: none;
  touch-action: none;
  flex-shrink: 0;
  transition: box-shadow 0.2s ease, transform 0.2s ease;

  ${props => props.$isSelected && css`
    box-shadow: 0 0 0 2px #d4af37, 0 12px 28px rgba(212, 175, 55, 0.35);
    transform: translateY(-8px);
  `}

  ${props => props.$isDisabled && css`
    opacity: 0.45;
    filter: grayscale(80%);
  `}

  @media (max-width: 480px) {
    width: ${props => props.$compact ? '56px' : '110px'};
    height: ${props => props.$compact ? '82px' : '162px'};
  }
`;

const CardBorder = styled.div`
  position: absolute;
  inset: 4px;
  border: 1px solid rgba(212, 175, 55, 0.45);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  padding: 6px;
  background: radial-gradient(circle at 50% 30%, #ffffff 0%, #f7f4ed 100%);
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ValueBadge = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #18181b;
  color: #d4af37;
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d4af37;
  flex-shrink: 0;
`;

const NameBlock = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const CardTitle = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: #18181b;
  white-space: nowrap;
  letter-spacing: -0.3px;
`;

const CardSub = styled.span`
  font-size: 8px;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const EmblemArea = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
`;

const DescriptionArea = styled.div`
  background: rgba(24, 24, 27, 0.04);
  border-radius: 4px;
  padding: 4px;
  border-top: 1px solid rgba(212, 175, 55, 0.2);
`;

const DescText = styled.p`
  margin: 0;
  font-size: 9px;
  line-height: 1.25;
  color: #3f3f46;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const DisabledBadge = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  color: #fca5a5;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 6px;
  border-radius: 6px;
`;
