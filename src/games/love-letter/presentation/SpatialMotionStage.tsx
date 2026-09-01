import React, { useLayoutEffect, useState } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { CardValue } from '../../../../packages/love-letter-core/src/types';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { GameCard } from '../ui/GameCard';
import { PresentationPhase } from '../machines/presentationMachine';
import { useTableAnchorRegistry } from './TableAnchorRegistry';
import { THEME } from '../../../shared/theme';

interface Point {
  x: number;
  y: number;
}

interface SpatialMotionStageProps {
  currentAction: GameEventEnvelope | null;
  phase?: PresentationPhase;
  myUserId?: string;
  onPhaseComplete?: () => void;
}

const TABLE_FALLBACK: Point = { x: 0.5, y: 0.49 };

function centerOf(element: Element | null, fallback: Point): Point {
  if (!element) return { x: window.innerWidth * fallback.x, y: window.innerHeight * fallback.y };
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Server state may already have advanced. This layer holds one visual action
 * until the card has visibly reached the table, target, and discard position.
 */
export const SpatialMotionStage: React.FC<SpatialMotionStageProps> = ({
  currentAction,
  phase = 'IDLE',
  myUserId = '',
  onPhaseComplete,
}) => {
  const registry = useTableAnchorRegistry();
  const reduceMotion = useReducedMotion();
  const [anchors, setAnchors] = useState<{ source: Point; table: Point; target: Point }>({
    source: { x: window.innerWidth / 2, y: window.innerHeight - 92 },
    table: { x: window.innerWidth / 2, y: window.innerHeight * TABLE_FALLBACK.y },
    target: { x: window.innerWidth / 2, y: window.innerHeight * 0.22 },
  });

  useLayoutEffect(() => {
    if (!currentAction || phase === 'IDLE') return;
    const event: any = currentAction.event;
    const measure = () => {
      const actorHand = event.actorId ? registry.get(event.actorId, 'hand') : null;
      const actorDiscard = event.actorId ? registry.get(event.actorId, 'discard') : null;
      const targetIdentity = event.targetId ? registry.get(event.targetId, 'identity') : null;
      setAnchors({
        source: centerOf(actorHand, event.actorId === myUserId ? { x: .5, y: .88 } : { x: .5, y: .18 }),
        table: centerOf(actorDiscard, event.actorId === myUserId ? { x: .5, y: .68 } : { x: .5, y: .28 }),
        target: centerOf(targetIdentity, { x: .5, y: .2 }),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [currentAction, phase, myUserId, registry]);

  if (!currentAction?.event || phase === 'IDLE') return null;

  const event: any = currentAction.event;
  const card = event.card;
  if (!card?.value) return null;

  const cardValue = card.value as CardValue;
  const showTarget = !!event.targetId && (phase === 'TARGET_REVEAL' || phase === 'EFFECT' || phase === 'RESULT');
  const destination = anchors.table;
  const cardMeta = CARD_DEFINITIONS[cardValue];
  const phaseDuration: Record<PresentationPhase, number> = { IDLE:0, CARD_PLAYING:.4, TARGET_REVEAL:.32, EFFECT:.32, RESULT:1.3, DISCARDING:.22, SETTLING:.18 };

  return (
    <MotionOverlay aria-live="polite">
      <PhaseClock as={motion.div} key={`${currentAction.eventId}_${phase}`} initial={{opacity:.001}} animate={{opacity:.002}} transition={{duration:reduceMotion ? .05 : phaseDuration[phase]}} onAnimationComplete={onPhaseComplete}/>
      {showTarget && <TargetConnector as={motion.svg} viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`} preserveAspectRatio="none" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.line x1={anchors.table.x} y1={anchors.table.y} x2={anchors.target.x} y2={anchors.target.y} stroke="rgba(127,29,47,.72)" strokeWidth="2" strokeDasharray="5 5" initial={{pathLength:0}} animate={{pathLength:1}} transition={{duration:reduceMotion ? .05 : .28}}/></TargetConnector>}
      {showTarget && <TargetReaction as={motion.div} style={{left:anchors.target.x-26,top:anchors.target.y-18}} initial={{opacity:0,scale:.82}} animate={{opacity:[0,1,.45],scale:[.82,1.08,1]}} transition={{duration:reduceMotion ? .05 : .4}}/>}
      <AnimatePresence mode="wait">
        <FlyingCard
          key={currentAction.eventId}
          as={motion.div}
          initial={{ x: anchors.source.x - 32, y: anchors.source.y - 48, rotate: -7, scale: 0.82, opacity: 0 }}
          animate={{
            x: destination.x - 32,
            y: destination.y - 48,
            rotate: phase === 'SETTLING' ? 5 : 0,
            scale: phase === 'CARD_PLAYING' ? .78 : .64,
            opacity: phase === 'SETTLING' ? 0 : 1,
          }}
          exit={{ opacity: 0, scale: 0.68 }}
          transition={{ duration: reduceMotion ? .05 : phase === 'CARD_PLAYING' ? .4 : .2, ease: 'easeInOut' }}
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

const PhaseClock = styled.div`position:fixed;width:1px;height:1px;pointer-events:none;`;
const TargetConnector = styled.svg`position:fixed;inset:0;width:100%;height:100%;overflow:visible;`;
const TargetReaction = styled.div`position:fixed;width:52px;height:36px;border:2px solid ${THEME.gold};border-radius:12px;box-shadow:0 0 0 4px rgba(197,160,89,.12);`;

const FlyingCard = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 64px;
  height: 96px;
  transform-origin: center;
  filter: drop-shadow(0 10px 16px rgba(9, 13, 22, 0.28));
`;
