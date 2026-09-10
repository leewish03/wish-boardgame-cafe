import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { createPortal } from 'react-dom';
import { motion, useAnimation, useReducedMotion } from 'framer-motion';
import { CardInstance, PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { PresentationAction } from './useActionTimeline';
import { buildPhysicalSequence } from './physicalSequence';
import { useTableAnchorRegistry } from './TableAnchorRegistry';
import { THEME } from '../../../shared/theme';
import { CardArtwork, CARD_WIDTH, CARD_HEIGHT } from '../ui/CardArtwork';

type Point = { x:number; y:number; width:number; height:number };
interface Props {
  currentAction: PresentationAction | null; onPhaseComplete?:()=>void;
  localUserId: string; players: PlayerPublic[]; returnedActionId?:string|null;
  onReturnCard: (actionId:string, version:number, callback:(result:{success:boolean;error?:string})=>void)=>void;
}

/** The visible card drives completion; there is no independent hidden clock. */
function TableCard({identity, stepId, from, to, card, faceUp, initialFaceUp=false, duration, onComplete, toOffset}: {
  identity:string;stepId:string;from:Point;to:Point;card?:CardInstance;faceUp:boolean;initialFaceUp?:boolean;duration:number;onComplete?:()=>void;toOffset?:{x:number;y:number;scale?:number};
}) {
  const controls=useAnimation();
  const done=useRef(onComplete); done.current=onComplete;
  const reduce=useReducedMotion();
  const started=useRef(false);
  const pose=(point:Point,offset?:{x:number;y:number;scale?:number})=>{
    const scale=Math.min(point.width/CARD_WIDTH,point.height/CARD_HEIGHT)*(offset?.scale ?? 1);
    return {x:point.x+point.width/2-CARD_WIDTH/2+(offset?.x ?? 0),y:point.y+point.height/2-CARD_HEIGHT/2+(offset?.y ?? 0),scale};
  };
  useLayoutEffect(()=>{
    let active=true;
    if (!started.current) { controls.set({...pose(from),rotateY:initialFaceUp?0:180}); started.current=true; }
    void controls.start({...pose(to,toOffset), rotateY:faceUp?0:180, transition:{duration:reduce?Math.min(duration,.12):duration,ease:[.22,1,.36,1]}})
      .then(()=>{if(active) done.current?.();});
    return()=>{active=false;};
  },[controls,stepId,to.x,to.y,to.width,to.height,faceUp,duration,reduce,toOffset?.x,toOffset?.y,toOffset?.scale]);
  return <CardObject as={motion.div} data-physical-card={identity} animate={controls} initial={{...pose(from),rotateY:initialFaceUp?0:180}}>
    <Front aria-hidden={!faceUp}><CardArtwork value={card?.value} name={card?.name}/></Front><Back aria-hidden={faceUp}><CardArtwork back/></Back>
  </CardObject>;
}

function ResultDwell({duration,onComplete}:{duration:number;onComplete:()=>void}) {
  return <motion.div aria-hidden="true" initial={{opacity:.99}} animate={{opacity:1}}
    transition={{duration,ease:'linear'}} onAnimationComplete={onComplete}
    style={{position:'fixed',width:1,height:1,pointerEvents:'none'}}/>;
}

export const SpatialMotionStage:React.FC<Props>=({currentAction,localUserId,players,returnedActionId,onReturnCard,onPhaseComplete})=>{
  const registry=useTableAnchorRegistry();
  const steps=buildPhysicalSequence(currentAction?.presentationEvents || []);
  const step=steps[currentAction?.presentationIndex || 0];
  const [geometry,setGeometry]=useState<Record<string,Point>|null>(null);
  const [requesting,setRequesting]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const completed=useRef<string|null>(null);
  const callback=useRef(onPhaseComplete);callback.current=onPhaseComplete;
  const finish=()=>{if(step && completed.current!==step.id){completed.current=step.id;callback.current?.();}};
  const played=(currentAction?.presentationEvents.find(e=>(e.event as any).type==='CARD_PLAYED')?.event as any)?.card as CardInstance|undefined;
  const priest=(currentAction?.presentationEvents.find(e=>(e.event as any).type==='PRIEST_USED')?.event as any);
  const comparison=(currentAction?.presentationEvents.find(e=>(e.event as any).type==='BARON_COMPARED')?.event as any);
  const actor=players.find(p=>p.id===step?.actorId);
  const target=players.find(p=>p.id===step?.targetId);
  const returned=returnedActionId===currentAction?.actionId;
  useLayoutEffect(()=>{
    if(!step) {setGeometry(null);return;}
    const point=(element:HTMLElement|null):Point|null=>{
      if(!element)return null; const r=element.getBoundingClientRect();
      return {x:r.left,y:r.top,width:r.width,height:r.height};
    };
    const hand=(id:string|undefined, card?:CardInstance)=>{
      if(!id)return null; const count=players.find(p=>p.id===id)?.cardCount || 1;
      const registered = card && registry.get(id,`card:${card.id}`);
      const visibleCard = registered?.querySelector<HTMLElement>('[data-card-id]');
      return point(visibleCard || registered || registry.get(id,count>1?'hand-slot-1':'hand-slot-0'));
    };
    const measure=()=>{
      const actorHand=hand(step.actorId,step.kind==='PLAY'?played:undefined);
      const targetHand=step.kind==='DRAW'
        ? point(registry.get(step.targetId!, (players.find(p => p.id === step.targetId)?.cardCount || 0) > 0 ? 'hand-slot-1' : 'hand-slot-0'))
        : hand(step.targetId,step.card);
      const play=point(registry.get(step.actorId,'play'));
      const review=point(registry.get(step.actorId,'review'));
      const targetReview=point(registry.get(step.targetId || step.actorId,'review'));
      const deck=point(registry.get('deck',step.apply?.drawSource==='SET_ASIDE'?'aside':'deck'));
      const discard=point(registry.get(step.actorId,'discard'));
      const targetDiscard=point(registry.get(step.targetId || step.actorId,'discard'));
      if(!actorHand || !review || !deck || !play || !discard || (step.targetId && !targetHand))return;
      const destination=(r:Point)=>r;
      const roundHands = Object.fromEntries(Object.keys(step.cards || {}).flatMap(id => { const p = hand(id); return p ? [[`round:${id}`, p]] : []; }));
      const measured = {...roundHands,actorHand,targetHand:targetHand || actorHand,play,review,targetReview:targetReview || review,deck,discard:destination(discard),targetDiscard:destination(targetDiscard || discard)};
      setGeometry(previous => JSON.stringify(previous) === JSON.stringify(measured) ? previous : measured);
    };
    measure();window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
    const observer = new window.ResizeObserver(measure);
    const controls = registry.get('table','review-controls');
    if (controls?.parentElement) observer.observe(controls.parentElement);
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
  },[step?.id,registry,players,played?.id]);
  useEffect(()=>{setRequesting(false);setError(null);},[currentAction?.actionId]);
  useEffect(()=>{if(step?.kind==='REVIEW' && returned) finish();},[step?.id,returned]);
  if(!step || !currentAction || !geometry)return null;
  const g=geometry;
  const review=g.review;
  const privatePhase=['BORROW','REVIEW','CONCEAL','RETURN'].includes(step.kind);
  const handEffect=['REVEAL','DISCARD_HAND','DRAW'].includes(step.kind);
  const doubleEffect=['COMPARE','COMPARE_REVIEW','RESTORE','SWAP'].includes(step.kind);
  const resultDwell=step.kind==='RESULT_DWELL';
  const drivingPlayed=!resultDwell&&!privatePhase&&!handEffect&&!doubleEffect;
  const returnCard=()=>{
    if(requesting)return;setRequesting(true);setError(null);
    onReturnCard(currentAction.actionId,currentAction.stateVersion,result=>{
      if(!result.success){setRequesting(false);setError(result.error || '반환하지 못했습니다. 다시 눌러 주세요.');}
    });
  };
  return <Layer data-physical-step={step.kind}>
    {step.kind==='ROUND_REVEAL' && Object.entries(step.cards || {}).map(([id, card], index, entries) => g[`round:${id}`] && <TableCard key={`round:${id}`} identity={`round:${id}`} stepId={step.id} from={g[`round:${id}`]} to={g[`round:${id}`]} card={card} faceUp duration={step.duration} onComplete={index===entries.length-1?finish:undefined}/>)}
    {played && <TableCard key={`${currentAction.actionId}:played`} identity={`played:${played.id}`} stepId={step.id}
      from={g.actorHand} to={step.kind==='CLEANUP'?g.discard:g.play} toOffset={privatePhase?{x:-5,y:5,scale:.94}:undefined} card={played} faceUp initialFaceUp={localUserId===step.actorId} duration={drivingPlayed?step.duration:0} onComplete={drivingPlayed?finish:undefined}/>}
    {privatePhase && <TableCard key={`${currentAction.actionId}:borrowed`} identity={`${currentAction.actionId}:borrowed`} stepId={step.id}
      from={g.targetHand} to={step.kind==='RETURN'?g.targetHand:review} toOffset={step.kind==='RETURN'?undefined:{x:5,y:-5,scale:.94}} card={priest?.revealedCard}
      faceUp={step.kind==='REVIEW' && localUserId===step.actorId} duration={step.duration}
      onComplete={step.kind==='REVIEW' && !returned && !actor?.isBot ? undefined : finish}/>}
    {handEffect && <TableCard key={`${currentAction.actionId}:hand:${step.targetId}:${step.card?.id || 'back'}`} identity={`${currentAction.actionId}:hand:${step.targetId}`} stepId={step.id}
      from={step.kind==='DRAW'?g.deck:g.targetHand} to={step.kind==='DISCARD_HAND'?g.targetDiscard:g.targetHand}
      card={step.card} faceUp={step.kind!=='DRAW' || step.targetId===localUserId} duration={step.duration} onComplete={finish}/>}
    {doubleEffect && [0,1].map(index=><TableCard key={`${currentAction.actionId}:exchange:${index}`} identity={`${currentAction.actionId}:exchange:${index}`} stepId={step.id}
      from={index?g.targetHand:g.actorHand}
      to={step.kind==='SWAP'?(index?g.actorHand:g.targetHand):step.kind==='RESTORE'?(index?g.targetHand:g.actorHand):(index?g.targetReview:review)}
      card={comparison?.comparisonHands?.[index ? step.targetId! : step.actorId]}
      faceUp={step.kind==='COMPARE_REVIEW' && [step.actorId,step.targetId].includes(localUserId)} duration={step.duration} onComplete={index===1?finish:undefined}/>)}
    {resultDwell && <ResultDwell duration={step.duration} onComplete={finish}/>}
    {step.kind==='REVIEW' && !returned && !actor?.isBot && registry.get('table','review-controls') && createPortal(<ReviewControls>
      <span>{actor?.nickname}님이 {target?.nickname}님의 카드를 확인 중</span>
      {localUserId===step.actorId && <button type="button" disabled={requesting} onClick={returnCard}>{requesting?'반환 요청 중…':'돌려주기'}</button>}
      {error && <span role="alert">{error}</span>}
    </ReviewControls>, registry.get('table','review-controls')!)}
  </Layer>;
};
const Layer=styled.div`position:fixed;inset:0;z-index:600;pointer-events:none;overflow:hidden;perspective:900px;`;
const CardObject=styled.div`position:absolute;left:0;top:0;width:154px;height:220px;transform-origin:center;transform-style:preserve-3d;will-change:transform;`;
const Front=styled.div`position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;`;
const Back=styled(Front)`transform:rotateY(180deg);`;
const ReviewControls=styled.div`
  position:relative;width:100%;display:grid;justify-items:center;gap:7px;margin-top:2px;text-align:center;color:${THEME.primary};font-size:10px;
  span{color:${THEME.mutedForeground};}
  button{pointer-events:auto;width:min(220px,100%);min-height:40px;padding:0 18px;border:1px solid ${THEME.goldAntique};border-radius:9px;background:${THEME.gradients.obsidianButton};color:white;font:900 12px ${THEME.font.serif};cursor:pointer;box-shadow:0 4px 10px rgba(9,13,22,.14);}
  button:disabled{opacity:.6;cursor:wait;}
`;
