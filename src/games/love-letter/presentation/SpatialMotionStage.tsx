import React, { useLayoutEffect, useState } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { CardValue, PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { GameCard } from '../ui/GameCard';
import { PresentationPhase } from '../machines/presentationMachine';

interface Point {
  x: number;
  y: number;
}

interface SpatialMotionStageProps {
  currentAction: GameEventEnvelope | null;
  phase?: PresentationPhase;
  myUserId?: string;
  players?: PlayerPublic[];
}

const TABLE_FALLBACK: Point = { x: 0.5, y: 0.49 };

function centerOf(element: Element | null, fallback: Point): Point {
  if (!element) return { x: window.innerWidth * fallback.x, y: window.innerHeight * fallback.y };
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function Avatar({ value, name }: { value?: string; name: string }) {
  const isImage = !!value && (value.startsWith('https://') || value.startsWith('http://') || value.startsWith('/'));
  return isImage ? <AvatarImage src={value} alt={name} /> : <AvatarGlyph>{name.slice(0, 1)}</AvatarGlyph>;
}

/**
 * Server state may already have advanced. This layer holds one visual action
 * until the card has visibly reached the table, target, and discard position.
 */
export const SpatialMotionStage: React.FC<SpatialMotionStageProps> = ({
  currentAction,
  phase = 'IDLE',
  myUserId = '',
  players = [],
}) => {
  const [anchors, setAnchors] = useState<{ source: Point; table: Point; target: Point }>({
    source: { x: window.innerWidth / 2, y: window.innerHeight - 92 },
    table: { x: window.innerWidth / 2, y: window.innerHeight * TABLE_FALLBACK.y },
    target: { x: window.innerWidth / 2, y: window.innerHeight * 0.22 },
  });

  useLayoutEffect(() => {
    if (!currentAction || phase === 'IDLE') return;
    const event: any = currentAction.event;
    const measure = () => {
      const actorSeat = event.actorId ? document.querySelector(`[data-player-id="${event.actorId}"]`) : null;
      const targetSeat = event.targetId ? document.querySelector(`[data-player-id="${event.targetId}"]`) : null;
      const actorPile = centerOf(actorSeat, event.actorId === myUserId ? { x: 0.5, y: 0.77 } : { x: 0.5, y: 0.2 });
      const source = event.actorId === myUserId
        ? { x: window.innerWidth / 2, y: window.innerHeight - 88 }
        : centerOf(actorSeat, { x: 0.5, y: 0.2 });
      setAnchors({ source, table: actorPile, target: centerOf(targetSeat, { x: 0.5, y: 0.2 }) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [currentAction, phase, myUserId]);

  if (!currentAction?.event || phase === 'IDLE') return null;

  const event: any = currentAction.event;
  const card = event.card;
  if (!card?.value) return null;

  const cardValue = card.value as CardValue;
  const actor = players.find((player) => player.id === event.actorId);
  const target = players.find((player) => player.id === event.targetId);
  const actorName = actor?.nickname || '플레이어';
  const targetName = target?.nickname || '상대방';
  const towardsTarget = phase === 'TARGET_REVEAL' || phase === 'EFFECT' || phase === 'RESULT';
  const discarding = phase === 'DISCARDING' || phase === 'SETTLING';
  const destination = discarding
    ? anchors.table
    : towardsTarget && event.targetId
    ? { x: anchors.target.x, y: anchors.target.y + 44 }
    : anchors.table;
  const cardMeta = CARD_DEFINITIONS[cardValue];

  return (
    <MotionOverlay aria-live="polite">
      <ActionLine
        as={motion.div}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
      >
        <Avatar value={actor?.avatar} name={actorName} />
        <strong>{actorName}</strong>
        <span>·</span>
        <CardLabel>{cardValue} {cardMeta?.name || card.name}</CardLabel>
        {event.targetId && <><span>→</span><strong>{targetName}</strong></>}
      </ActionLine>

      <AnimatePresence mode="wait">
        <FlyingCard
          key={currentAction.eventId}
          as={motion.div}
          initial={{ x: anchors.source.x - 32, y: anchors.source.y - 48, rotate: -7, scale: 0.82, opacity: 0 }}
          animate={{
            x: destination.x - 32,
            y: destination.y - 48,
            rotate: discarding ? 7 : 0,
            scale: discarding ? 0.76 : 1,
            opacity: 1,
          }}
          exit={{ opacity: 0, scale: 0.68 }}
          transition={{ duration: phase === 'CARD_PLAYING' ? 0.46 : 0.36, ease: 'easeInOut' }}
        >
          <GameCard value={cardValue} name={card.name || cardMeta?.name || '카드'} compact />
        </FlyingCard>
      </AnimatePresence>
    </MotionOverlay>
  );
};

const MotionOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 600;
  pointer-events: none;
  overflow: hidden;
`;

const ActionLine = styled.div`
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100vw - 28px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid rgba(212, 175, 55, 0.78);
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.93);
  color: #f8fafc;
  box-shadow: 0 6px 18px rgba(9, 13, 22, 0.28);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  strong { overflow: hidden; text-overflow: ellipsis; }

  @media (max-width: 380px) { top: 46px; font-size: 10px; }
`;

const AvatarImage = styled.img`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 auto;
`;

const AvatarGlyph = styled.span`
  font-size: 16px;
  line-height: 1;
`;

const CardLabel = styled.span`
  color: #f6d881;
  font-weight: 800;
`;

const FlyingCard = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 64px;
  height: 96px;
  transform-origin: center;
  filter: drop-shadow(0 10px 16px rgba(9, 13, 22, 0.28));
`;
