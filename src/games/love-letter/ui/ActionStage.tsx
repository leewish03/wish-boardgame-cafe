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
  return <StageContainer aria-label={`덱 ${deckCount}장 남음`}><DeckSlot count={deckCount} setAsideCount={setAsideCount} /><Narration aria-live="polite">{actionError ? <em>{actionError}</em> : selection || (event ? <><strong>{actor || '플레이어'} · {card?.name || card?.value || '카드'} 사용</strong>{hasTarget && <span>{target ? `${target} 대상` : '대상 지정'}</span>}{result && <em>{result}</em>}</> : <span>현재 행동을 기다리는 중</span>)}</Narration></StageContainer>;
};

const StageContainer = styled.section`
  width:100%; min-width:0; min-height:0; display:grid; grid-template-columns:72px minmax(0, 1fr); align-items:center; justify-content:center; gap:10px; padding:4px 14px; box-sizing:border-box;
  @media (max-height:650px){grid-template-columns:58px minmax(0, 1fr);gap:7px;padding:2px 10px;}
`;
const Narration = styled.div`min-width:0; min-height:42px; max-width:360px; text-align:left; display:flex; flex-direction:column; justify-content:center; gap:3px; color:${THEME.foreground}; font-size:11px; line-height:1.3; strong{font-weight:900;} span{color:${THEME.mutedForeground};} em{font-style:normal;color:${THEME.burgundy};font-weight:800;} @media(max-width:360px){font-size:10px;} @media(max-height:650px){min-height:32px;}`;
