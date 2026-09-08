import React from 'react';
import styled, { css } from 'styled-components';
import { motion, PanInfo } from 'framer-motion';
import { CardArtwork } from './CardArtwork';
import { CardValue } from '../../../../packages/love-letter-core/src/types';

export interface GameCardProps {
  value: CardValue;
  name: string;
  id?: string;
  isSelected?: boolean;
  isDisabled?: boolean;
  isInteractive?: boolean;
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
  isInteractive = !isDisabled,
  disabledReason,
  onClick,
  onDragStart,
  onDrag,
  onDragEnd,
  enableDrag = false,
  compact = false,
}) => {
  return (
    <CardContainer
      as={motion.div}
      $isSelected={isSelected}
      $isDisabled={isDisabled}
      $compact={compact}
      onClick={isInteractive && !isDisabled ? onClick : undefined}
      drag={enableDrag && isInteractive && !isDisabled ? true : false}
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
      whileHover={isInteractive && !isDisabled ? { y: -5, scale: 1.02 } : undefined}
      whileTap={isInteractive && !isDisabled ? { scale: 0.98 } : undefined}
      aria-disabled={!isInteractive || isDisabled}
      animate={{ y: isSelected ? -8 : 0 }}
      data-card-id={id}
      data-card-value={value}
    >
      <CardArtwork value={value} name={name}/>
        {isDisabled && disabledReason && (
          <DisabledBadge>
            <LockIcon>잠금</LockIcon>
            <LockText>{disabledReason}</LockText>
          </DisabledBadge>
        )}
    </CardContainer>
  );
};

const CardContainer = styled.div<{ $isSelected: boolean; $isDisabled: boolean; $compact: boolean }>`
  position: relative;
  width: ${props => props.$compact ? '64px' : 'clamp(106px, 29vw, 154px)'};
  aspect-ratio: 154 / 220;
  height: auto;

  background: #fdfbf7;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(212, 175, 55, 0.4);
  cursor: ${props => props.$isDisabled ? 'not-allowed' : 'pointer'};
  user-select: none;
  touch-action: none;
  flex-shrink: 0;
  transition: box-shadow 0.2s ease;

  ${props => props.$isSelected && css`
    box-shadow: 0 0 0 2px #d4af37, 0 12px 28px rgba(212, 175, 55, 0.35);

  `}

  ${props => props.$isDisabled && css`
    opacity: 0.45;
    filter: grayscale(80%);
  `}

  @media (max-height: 650px) { width: ${props => props.$compact ? '54px' : '96px'}; }
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
