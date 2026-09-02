import React from 'react';
import styled from 'styled-components';
import { DeckSlot } from './DeckSlot';
import { GameEventSummary, CardInstance } from '../../../../packages/love-letter-core/src/types';
import { PresentationPhase } from '../machines/presentationMachine';
import { PresentationAction } from '../presentation/useActionTimeline';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { THEME } from '../../../shared/theme';
import { PlayerPublic } from '../../../../packages/love-letter-core/src/types';

interface ActionStageProps { deckCount:number; setAsideCount?:number; players?:PlayerPublic[]; lastAction:GameEventSummary|null; interactionState?:string; actionError?:string|null; isOverDropZone?:boolean; activeCard?:CardInstance|null; targetPlayerName?:string|null; onCancelAction?:()=>void; onSelectSelfTarget?:()=>void; onOpenCardHelper?:()=>void; presentationAction?:PresentationAction|null; presentationPhase?:PresentationPhase; }

/** The centre of the table is intentionally only the draw deck. Played cards live at player seats. */
export const ActionStage: React.FC<ActionStageProps> = ({ deckCount, setAsideCount=0, players=[], lastAction, presentationAction, presentationPhase, interactionState, actionError, activeCard, targetPlayerName }) => {
  const played = presentationAction?.presentationEvents.find(envelope => (envelope.event as any).type === 'CARD_PLAYED');
  const visibleEvents = presentationAction?.presentationEvents.slice(0, (presentationAction.presentationIndex || 0) + 1) || [];
  const targetEvent: any = [...visibleEvents].reverse().find(envelope => (envelope.event as any).targetId)?.event;
  const resultEvent: any = [...visibleEvents].reverse().find(envelope => {
    const type = (envelope.event as any).type;
    return ['GUARD_SUCCESS', 'GUARD_FAILED', 'PRIEST_USED', 'BARON_COMPARED', 'PLAYER_PROTECTED', 'PRINCE_DISCARDED', 'HANDS_SWAPPED', 'PLAYER_ELIMINATED'].includes(type);
  })?.event;
  const event: any = presentationAction?.event || lastAction;
  const actionEvent: any = played?.event || event;
  const actor = actionEvent?.actorName || actionEvent?.actorNickname || players.find(player => player.id === actionEvent?.actorId)?.nickname || actionEvent?.actorId;
  const target = targetPlayerName || players.find(player => player.id === (targetEvent?.targetId || actionEvent?.targetId))?.nickname;
  const card = actionEvent?.card || actionEvent?.playedCard;
  const result = (resultEvent as any)?.presentation?.description || (event as any)?.presentation?.description || (presentationPhase === 'RESULT' ? (event?.reason || event?.resultDescription || event?.description) : null);
  const selection = interactionState === 'TARGETING' && activeCard ? `${activeCard.name} 사용 대상 선택` : interactionState === 'GUESSING' ? '경비병이 지목할 숫자를 선택하세요' : null;
  const hasTarget = Boolean(targetEvent?.targetId || actionEvent?.targetId);
  return <StageContainer aria-label={`덱 ${deckCount}장 남음`}>
    <DeckDock><DeckSlot count={deckCount} setAsideCount={setAsideCount} /></DeckDock>
    <Narration aria-live="polite">{actionError ? <em>{actionError}</em> : selection || (event ? <><strong>{actor || '플레이어'} · {card?.name || card?.value || '카드'} 사용</strong>{hasTarget && <span>{target ? `${target} 대상` : '대상 지정'}</span>}{result && <em>{result}</em>}</> : <span>현재 행동을 기다리는 중</span>)}</Narration>
  </StageContainer>;
};

const StageContainer = styled.section`
  width:100%; min-width:0; min-height:0; display:grid; grid-template-columns:58px minmax(0, 1fr); align-items:center; gap:10px; padding:5px 12px; box-sizing:border-box;
  @media (max-width:360px){grid-template-columns:50px minmax(0,1fr);gap:7px;padding-inline:8px;}
  @media (max-height:650px){grid-template-columns:48px minmax(0,1fr);gap:7px;padding-block:2px;}
`;
const DeckDock = styled.div`min-width:0;display:grid;place-items:center;`;
const Narration = styled.div`
  width:100%; min-width:0; min-height:58px; max-width:390px; padding:10px 13px; box-sizing:border-box;
  text-align:left; display:flex; flex-direction:column; justify-content:center; gap:4px;
  border:1px solid ${THEME.gold}; border-radius:12px; background:rgba(255,253,247,.95);
  box-shadow:0 8px 22px rgba(9,13,22,.10); color:${THEME.foreground}; font-size:11px; line-height:1.35;
  strong{font-weight:900;} span{color:${THEME.mutedForeground};} em{font-style:normal;color:${THEME.burgundy};font-weight:800;}
  @media(max-width:360px){min-height:52px;padding:8px 10px;font-size:10px;border-radius:10px;}
  @media(max-height:650px){min-height:44px;padding:7px 10px;}
`;
