import React from 'react';
import styled, { css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { DeckSlot } from './DeckSlot';
import { GameCard } from './GameCard';
import { GameEventSummary, CardInstance } from '../../../../packages/love-letter-core/src/types';
import { THEME } from '../../../shared/theme';

interface ActionStageProps {
  deckCount: number;
  lastAction: GameEventSummary | null;
  interactionState?: string;
  isOverDropZone?: boolean;
  activeCard?: CardInstance | null;
  targetPlayerName?: string | null;
  onCancelAction?: () => void;
  onSelectSelfTarget?: () => void;
  onOpenCardHelper?: () => void;
}

export const ActionStage: React.FC<ActionStageProps> = ({
  deckCount,
  lastAction,
  interactionState = 'IDLE',
  isOverDropZone = false,
  activeCard = null,
  targetPlayerName = null,
  onCancelAction,
  onSelectSelfTarget,
  onOpenCardHelper,
}) => {
  const isDragging = interactionState === 'DRAGGING' || interactionState === 'VALID_DROP';
  const isTargeting = interactionState === 'TARGETING';
  const isGuessing = interactionState === 'GUESSING';
  const isSubmitting = interactionState === 'SUBMITTING';

  return (
    <StageContainer>
      <DeckSlot count={deckCount} />

      {/* Central Action Arena / Drop Zone with explicit ID for collision hit testing */}
      <ArenaSlot
        id="action-stage-drop-zone"
        $isDragging={isDragging}
        $isOverDropZone={isOverDropZone}
        $isTargeting={isTargeting || isGuessing}
        $isSubmitting={isSubmitting}
      >
        <AnimatePresence mode="wait">
          {/* 1. Staged Active Card (During Targeting / Guessing / Submitting) */}
          {activeCard && (isTargeting || isGuessing || isSubmitting) ? (
            <StagedCardWrapper
              key={`staged_${activeCard.id}`}
              as={motion.div}
              initial={{ scale: 0.8, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <GameCard
                value={activeCard.value}
                name={activeCard.name}
                compact
              />
              <StatusBadge
                $isTargeting={isTargeting}
                $isGuessing={isGuessing}
                $isSubmitting={isSubmitting}
              >
                {isTargeting && (
                  <>
                    <span>🎯 대상 선택</span>
                    {activeCard.value === 5 && onSelectSelfTarget && (
                      <SelfTargetBtn onClick={onSelectSelfTarget} title="나 자신을 지목하기">
                        👑 나 자신 지목
                      </SelfTargetBtn>
                    )}
                    {onCancelAction && (
                      <CancelMiniBtn onClick={onCancelAction} title="취소">
                        ✕
                      </CancelMiniBtn>
                    )}
                  </>
                )}
                {isGuessing && (
                  <>
                    <span>🔮 {targetPlayerName ? `[${targetPlayerName}] 추측` : '추측 중'}</span>
                    {onCancelAction && (
                      <CancelMiniBtn onClick={onCancelAction} title="취소">
                        ✕
                      </CancelMiniBtn>
                    )}
                  </>
                )}
                {isSubmitting && <span>⏳ 제출 확인 중...</span>}
              </StatusBadge>
            </StagedCardWrapper>
          ) : isDragging ? (
            /* 2. Dragging Over Arena */
            <DragPromptWrapper
              key="drag_prompt"
              as={motion.div}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: isOverDropZone ? 1.05 : 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
            >
              <DropIcon>{isOverDropZone ? '✨' : '📥'}</DropIcon>
              <DropText $isOver={isOverDropZone}>
                {isOverDropZone ? '카드를 놓아 사용' : '여기로 끌어오세요'}
              </DropText>
            </DragPromptWrapper>
          ) : lastAction && lastAction.card ? (
            /* 3. Last Action Presentation */
            <ActionCardWrapper
              key={lastAction.actionId || `last_${lastAction.card.id}`}
              as={motion.div}
              initial={{ scale: 0.7, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            >
              <GameCard
                value={lastAction.card.value}
                name={lastAction.card.name}
                compact
              />
              <ActionSummaryBadge title={lastAction.description}>
                {lastAction.description}
              </ActionSummaryBadge>
            </ActionCardWrapper>
          ) : (
            /* 4. Idle Placeholder */
            <ArenaPlaceholder key="idle_placeholder">
              <TableCrest>👑</TableCrest>
              <ArenaHintText>카드를 위로 끌어 사용</ArenaHintText>
            </ArenaPlaceholder>
          )}
        </AnimatePresence>
      </ArenaSlot>
    </StageContainer>
  );
};

const StageContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  height: 120px;
  min-height: 120px;
  max-height: 120px;
  padding: 2px 10px;
  box-sizing: border-box;
  flex-shrink: 0;

  @media (max-width: 360px) {
    height: 112px;
    min-height: 112px;
    max-height: 112px;
    gap: 8px;
  }
`;

const ArenaSlot = styled.div<{
  $isDragging: boolean;
  $isOverDropZone: boolean;
  $isTargeting: boolean;
  $isSubmitting: boolean;
}>`
  position: relative;
  width: 150px;
  height: 104px;
  border-radius: ${THEME.radius.xl};
  border: 1.5px dashed ${THEME.border};
  background-color: rgba(255, 255, 255, 0.75);
  background-image: ${THEME.gradients.marbleSlab};
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 4px rgba(9, 13, 22, 0.04);
  transition: all 0.2s ease;
  box-sizing: border-box;

  ${props =>
    props.$isDragging &&
    css`
      border-color: ${THEME.gold};
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      box-shadow: 0 0 16px rgba(197, 160, 89, 0.35);
    `}

  ${props =>
    props.$isOverDropZone &&
    css`
      border-color: ${THEME.gold};
      border-style: solid;
      background: linear-gradient(135deg, #fef08a 0%, #fde047 100%);
      transform: scale(1.04);
      box-shadow: 0 0 24px rgba(197, 160, 89, 0.6);
    `}

  ${props =>
    props.$isTargeting &&
    css`
      border-color: ${THEME.gold};
      border-style: solid;
      background: #ffffff;
      box-shadow: 0 0 16px rgba(197, 160, 89, 0.35);
    `}

  @media (max-width: 360px) {
    width: 136px;
    height: 96px;
  }
`;

const StagedCardWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
`;

const StatusBadge = styled.div<{
  $isTargeting: boolean;
  $isGuessing: boolean;
  $isSubmitting: boolean;
}>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9.5px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: ${THEME.radius.full};
  white-space: nowrap;

  ${props =>
    (props.$isTargeting || props.$isGuessing) &&
    css`
      background: ${THEME.gradients.obsidianButton};
      color: ${THEME.goldLight};
      border: 1px solid ${THEME.gold};
      box-shadow: 0 2px 6px rgba(9, 13, 22, 0.3);
    `}

  ${props =>
    props.$isSubmitting &&
    css`
      background: #f1f5f9;
      color: ${THEME.mutedForeground};
      border: 1px solid ${THEME.border};
    `}
`;

const CancelMiniBtn = styled.button`
  background: transparent;
  border: none;
  color: ${THEME.goldLight};
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;

  &:hover {
    color: #ffffff;
  }
`;

const SelfTargetBtn = styled.button`
  background: ${THEME.gold};
  color: #000000;
  border: none;
  border-radius: ${THEME.radius.full};
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 2px;
  transition: all 0.15s ease;

  &:hover {
    filter: brightness(1.1);
    transform: scale(1.04);
  }
`;

const DragPromptWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  pointer-events: none;
`;

const DropIcon = styled.div`
  font-size: 22px;
  line-height: 1;
`;

const DropText = styled.span<{ $isOver: boolean }>`
  font-size: 10.5px;
  font-weight: 800;
  color: ${props => (props.$isOver ? THEME.foreground : THEME.goldAntique)};
  text-align: center;
`;

const ActionCardWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  max-width: 140px;
`;

const ActionSummaryBadge = styled.div`
  font-size: 9.5px;
  font-weight: 700;
  color: #ffffff;
  background: ${THEME.gradients.obsidianButton};
  border: 1px solid ${THEME.gold};
  padding: 2px 8px;
  border-radius: ${THEME.radius.full};
  white-space: nowrap;
  max-width: 135px;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 2px 6px rgba(9, 13, 22, 0.25);
`;

const ArenaPlaceholder = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: ${THEME.mutedForeground};
  user-select: none;
  pointer-events: none;
`;

const TableCrest = styled.span`
  font-size: 16px;
  opacity: 0.6;
`;

const ArenaHintText = styled.span`
  font-size: 10px;
  font-weight: 600;
  color: ${THEME.mutedForeground};
  letter-spacing: -0.2px;
`;
