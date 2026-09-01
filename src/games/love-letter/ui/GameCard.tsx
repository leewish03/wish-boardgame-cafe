import React from 'react';
import styled, { css } from 'styled-components';
import { motion, PanInfo } from 'framer-motion';
import { getHeraldicIcon } from '../presentation/heraldicIcons';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { CardValue } from '../../../../packages/love-letter-core/src/types';

export interface GameCardProps {
  value: CardValue;
  name: string;
  id?: string;
  isSelected?: boolean;
  isDisabled?: boolean;
  isDragging?: boolean;
  disabledReason?: string;
  onClick?: () => void;
  onDragStart?: () => void;
  onDrag?: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  onDragEnd?: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  enableDrag?: boolean;
  compact?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({
  value,
  name,
  id,
  isSelected = false,
  isDisabled = false,
  disabledReason,
  onClick,
  onDragStart,
  onDrag,
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
      drag={enableDrag && !isDisabled ? true : false}
      dragSnapToOrigin
      dragElastic={0.25}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      whileDrag={{
        scale: 1.04,
        y: -8,
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45), 0 0 24px rgba(212, 175, 55, 0.7)',
        zIndex: 100,
      }}
      whileHover={!isDisabled ? { y: -5, scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      layout
      data-card-id={id}
      data-card-value={value}
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
          {getHeraldicIcon(value, compact ? 22 : 34)}
        </EmblemArea>

        {!compact && (
          <DescriptionArea>
            <DescText>{meta.description}</DescText>
          </DescriptionArea>
        )}

        {isDisabled && disabledReason && (
          <DisabledBadge>
            <LockIcon>잠금</LockIcon>
            <LockText>{disabledReason}</LockText>
          </DisabledBadge>
        )}
      </CardBorder>
    </CardContainer>
  );
};

const CardContainer = styled.div<{ $isSelected: boolean; $isDisabled: boolean; $compact: boolean }>`
  position: relative;
  width: ${props => props.$compact ? '64px' : 'clamp(96px, 29vw, 126px)'};
  height: ${props => props.$compact ? '96px' : 'clamp(142px, 43vw, 182px)'};
  min-width: ${props => props.$compact ? '60px' : '92px'};
  min-height: ${props => props.$compact ? '88px' : '138px'};
  background: #fdfbf7;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(212, 175, 55, 0.4);
  cursor: ${props => props.$isDisabled ? 'not-allowed' : 'pointer'};
  user-select: none;
  touch-action: none;
  flex-shrink: 0;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

  ${props => props.$isSelected && css`
    box-shadow: 0 0 0 2px #d4af37, 0 12px 28px rgba(212, 175, 55, 0.35);
    transform: translateY(-8px);
  `}

  ${props => props.$isDisabled && css`
    opacity: 0.45;
    filter: grayscale(80%);
  `}

  @media (max-height: 650px) { width: ${props => props.$compact ? '54px' : '96px'}; height: ${props => props.$compact ? '80px' : '142px'}; }
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
  gap: 5px;
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
  padding: 2px 0;
`;

const DescriptionArea = styled.div`
  background: rgba(24, 24, 27, 0.04);
  border-radius: 4px;
  padding: 4px;
  border-top: 1px solid rgba(212, 175, 55, 0.2);
`;

const DescText = styled.p`
  margin: 0;
  font-size: clamp(7.6px, 2vw, 8.5px);
  line-height: 1.25;
  color: #3f3f46;
  text-align: center;
`;

const DisabledBadge = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(18, 18, 20, 0.82);
  backdrop-filter: blur(2px);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
  z-index: 10;
`;

const LockIcon = styled.span`
  font-size: 8px;
  text-transform: uppercase;
`;

const LockText = styled.span`
  font-size: 9.5px;
  font-weight: 700;
  color: #fca5a5;
  text-align: center;
  line-height: 1.3;
  letter-spacing: -0.2px;
`;
