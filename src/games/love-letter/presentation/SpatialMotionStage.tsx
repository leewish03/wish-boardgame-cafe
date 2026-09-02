import React, { useLayoutEffect, useState } from 'react';
import styled from 'styled-components';
import { motion, useReducedMotion } from 'framer-motion';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { CardInstance, CardValue } from '../../../../packages/love-letter-core/src/types';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { GameCard } from '../ui/GameCard';
import { PresentationPhase } from '../machines/presentationMachine';
import { useTableAnchorRegistry } from './TableAnchorRegistry';
import { THEME } from '../../../shared/theme';

interface Point { x:number; y:number; }
interface SpatialMotionStageProps { currentAction:GameEventEnvelope|null; phase?:PresentationPhase; onPhaseComplete?:()=>void; }
type MotionKind = 'draw' | 'play' | 'forcedDiscard' | 'revealDiscard' | 'swap' | 'target' | 'reaction';

const fallback = (x:number, y:number):Point => ({ x:window.innerWidth*x, y:window.innerHeight*y });
const pointOf = (element:Element|null, otherwise:Point):Point => {
  if (!element) return otherwise;
  const rect=element.getBoundingClientRect();
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
};

function kindFor(event:any):MotionKind {
  if (event.type === 'CARD_DRAWN') return 'draw';
  if (event.type === 'CARD_PLAYED') return 'play';
  if (event.type === 'PRINCE_DISCARDED') return 'forcedDiscard';
  if (event.type === 'HANDS_SWAPPED') return 'swap';
  if (event.type === 'PLAYER_ELIMINATED') return 'revealDiscard';
  if ((event.type === 'GUARD_SUCCESS' || event.type === 'GUARD_SUCCEEDED' || event.type === 'BARON_COMPARED') && (event.eliminatedId || event.presentation?.eliminatedPlayerId)) return 'revealDiscard';
  if (event.targetId) return 'target';
  return 'reaction';
}

function visibleCard(event:any, kind:MotionKind, priorEvent?:any):CardInstance|null {
  if (kind === 'draw' || kind === 'swap') return null;
  return event.discardedCard || event.guessedCard || event.revealedCard || event.presentation?.revealedCard || event.card || priorEvent?.discardedCard || priorEvent?.guessedCard || priorEvent?.revealedCard || priorEvent?.card || null;
}

export const SpatialMotionStage:React.FC<SpatialMotionStageProps>=({currentAction,phase='IDLE',onPhaseComplete})=>{
  const registry=useTableAnchorRegistry();
  const reduceMotion=useReducedMotion();
  const event:any=currentAction?.event;
  const kind=event ? kindFor(event) : 'reaction';
  const [points,setPoints]=useState<{deck:Point;aside:Point;actorHand:Point;actorDiscard:Point;targetHand:Point;targetDiscard:Point;targetIdentity:Point}>({
    deck:fallback(.12,.5),aside:fallback(.2,.5),actorHand:fallback(.5,.85),actorDiscard:fallback(.5,.72),targetHand:fallback(.5,.2),targetDiscard:fallback(.5,.3),targetIdentity:fallback(.5,.16),
  });

  useLayoutEffect(()=>{
    if(!event || phase==='IDLE') return;
    const measure=()=>{
      const actorId=event.actorId || event.playerId;
      const targetId=event.targetId || event.playerId || event.eliminatedId || event.presentation?.eliminatedPlayerId;
      const eliminatedId=event.eliminatedId || event.presentation?.eliminatedPlayerId || event.playerId;
      setPoints({
        deck:pointOf(registry.get('deck','deck'),fallback(.12,.5)),
        aside:pointOf(registry.get('deck','aside'),fallback(.2,.5)),
        actorHand:pointOf(registry.get(actorId,'hand-slot-1') || registry.get(actorId,'hand-slot-0') || registry.get(actorId,'hand'),fallback(.5,.82)),
        actorDiscard:pointOf(registry.get(actorId,'discard-latest') || registry.get(actorId,'discard'),fallback(.5,.7)),
        targetHand:pointOf(registry.get(targetId,'hand-slot-1') || registry.get(targetId,'hand-slot-0') || registry.get(targetId,'hand'),fallback(.5,.2)),
        targetDiscard:pointOf(registry.get(targetId,'discard-latest') || registry.get(targetId,'discard'),fallback(.5,.3)),
        targetIdentity:pointOf(registry.get(eliminatedId || targetId,'identity'),fallback(.5,.17)),
      });
    };
    measure();
    window.addEventListener('resize',measure);
    return()=>window.removeEventListener('resize',measure);
  },[event,phase,registry]);

  const isResultHold=phase==='RESULT';
  const priorRevealEvent = (currentAction as any)?.presentationEvents?.slice(0, (currentAction as any)?.presentationIndex || 0).reverse().map((envelope:any) => envelope.event).find((candidate:any) => candidate?.discardedCard || candidate?.guessedCard || candidate?.revealedCard || candidate?.card);
  const card=event ? visibleCard(event,kind,priorRevealEvent) : null;
  // A card table is read in cause-and-effect order. These are deliberately
  // slower than generic UI transitions so the next server action cannot look
  // like it happened at the same time.
  const duration=reduceMotion ? .05 : isResultHold ? 1.75 : kind==='swap' ? .9 : kind==='target' || kind==='reaction' ? .85 : kind==='draw' ? .65 : .72;
  const source=kind==='draw' ? (event?.drawSource === 'SET_ASIDE' ? points.aside : points.deck) : kind==='forcedDiscard' || kind==='revealDiscard' ? points.targetHand : points.actorHand;
  const destination=kind==='draw' ? points.targetHand : kind==='forcedDiscard' || kind==='revealDiscard' ? points.targetDiscard : points.actorDiscard;
  const canFly=!isResultHold && (kind==='draw' || kind==='play' || kind==='forcedDiscard' || kind==='revealDiscard');
  const showConnector=!isResultHold && (kind==='target' || kind==='swap');
  if(!event || phase==='IDLE') return null;

  return <MotionOverlay aria-live="polite">
    <React.Fragment key={`${currentAction?.eventId}:${phase}:${(currentAction as any)?.presentationIndex || 0}`}>
    {/* This is the one sequencing driver. It is a real Framer Motion node,
        keyed for every event/phase, so a RESULT hold cannot reuse a completed
        animation and leave the presentation queue stuck. */}
    <motion.div
      key={`${currentAction?.eventId}:${phase}:${(currentAction as any)?.presentationIndex || 0}`}
      style={{ position:'fixed', width:1, height:1, opacity:0, pointerEvents:'none' }}
      initial={{ scale:.98 }}
      animate={{ scale:1 }}
      transition={{ duration, ease:'linear' }}
      onAnimationComplete={onPhaseComplete}
    />
    {showConnector && <Connector as={motion.svg} viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`} preserveAspectRatio="none" initial={{opacity:0}} animate={{opacity:1}}><motion.line x1={points.actorDiscard.x} y1={points.actorDiscard.y} x2={kind==='swap'?points.targetHand.x:points.targetIdentity.x} y2={kind==='swap'?points.targetHand.y:points.targetIdentity.y} stroke="rgba(127,29,47,.72)" strokeWidth="2" strokeDasharray="5 5" initial={{pathLength:0}} animate={{pathLength:1}} transition={{duration:Math.min(.75,duration)}}/></Connector>}
    {!isResultHold && (kind==='target' || kind==='reaction' || kind==='revealDiscard') && (
      <SeatReaction as={motion.div} style={{left:points.targetIdentity.x-27,top:points.targetIdentity.y-18}} initial={{opacity:0,scale:.8}} animate={{opacity:[0,1,.35],scale:[.8,1.06,1]}} transition={{duration}} $eliminated={kind==='revealDiscard'}/>
    )}
    {canFly && <FlyingCard as={motion.div} initial={{x:source.x-32,y:source.y-46,scale:.74,rotate:-5,opacity:0}} animate={{x:destination.x-32,y:destination.y-46,scale:.64,rotate:kind==='forcedDiscard'||kind==='revealDiscard'?5:0,opacity:1}} transition={{duration,ease:[.16,1,.3,1]}}>
      {card ? <GameCard value={card.value as CardValue} name={card.name || CARD_DEFINITIONS[card.value as CardValue]?.name || '카드'} compact/> : <CardBack/>}
    </FlyingCard>}
    {kind==='swap' && <>
      <FlyingBack as={motion.div} key={`${currentAction?.eventId}_a`} initial={{x:points.actorHand.x-14,y:points.actorHand.y-20,opacity:0}} animate={{x:points.targetHand.x-14,y:points.targetHand.y-20,opacity:1}} transition={{duration,ease:[.16,1,.3,1]}}/>
      <FlyingBack as={motion.div} key={`${currentAction?.eventId}_b`} initial={{x:points.targetHand.x-14,y:points.targetHand.y-20,opacity:0}} animate={{x:points.actorHand.x-14,y:points.actorHand.y-20,opacity:1}} transition={{duration,ease:[.16,1,.3,1]}}/>
    </>}
    </React.Fragment>
  </MotionOverlay>;
};

const MotionOverlay=styled.div`position:fixed;inset:0;z-index:600;pointer-events:none;overflow:hidden;`;
const Connector=styled.svg`position:fixed;inset:0;width:100%;height:100%;overflow:visible;`;
const SeatReaction=styled.div<{$eliminated:boolean}>`position:fixed;width:54px;height:36px;border:2px solid ${p=>p.$eliminated?THEME.burgundy:THEME.gold};border-radius:12px;box-shadow:0 0 0 4px rgba(197,160,89,.12);`;
const FlyingCard=styled.div`position:fixed;top:0;left:0;width:64px;height:96px;transform-origin:center;filter:drop-shadow(0 10px 16px rgba(9,13,22,.28));`;
const FlyingBack=styled.div`position:fixed;top:0;left:0;width:28px;height:40px;border:1px solid ${THEME.goldAntique};border-radius:5px;background:${THEME.burgundyDeep};box-shadow:2px 4px 8px rgba(9,13,22,.25);`;
const CardBack=styled.div`width:64px;height:94px;border:1px solid ${THEME.goldAntique};border-radius:8px;background:${THEME.burgundyDeep};box-shadow:inset 0 0 0 2px rgba(255,255,255,.08);`;

