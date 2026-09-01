import React from 'react';
import styled from 'styled-components';
import { DeckSlot } from './DeckSlot';
import { GameEventSummary, CardInstance } from '../../../../packages/love-letter-core/src/types';
import { PresentationPhase } from '../machines/presentationMachine';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { THEME } from '../../../shared/theme';
import { PlayerPublic } from '../../../../packages/love-letter-core/src/types';

interface ActionStageProps { deckCount:number; setAsideCount?:number; players?:PlayerPublic[]; lastAction:GameEventSummary|null; interactionState?:string; actionError?:string|null; isOverDropZone?:boolean; activeCard?:CardInstance|null; targetPlayerName?:string|null; onCancelAction?:()=>void; onSelectSelfTarget?:()=>void; onOpenCardHelper?:()=>void; presentationAction?:GameEventEnvelope|null; presentationPhase?:PresentationPhase; }

/** The centre of the table is intentionally only the draw deck. Played cards live at player seats. */
export const ActionStage: React.FC<ActionStageProps> = ({ deckCount, setAsideCount=0, players=[], lastAction, presentationAction, interactionState, actionError, activeCard, targetPlayerName }) => {
  const event: any = presentationAction?.event || lastAction;
  const actor = event?.actorName || event?.actorNickname || players.find(player => player.id === event?.actorId)?.nickname || event?.actorId;
  const target = targetPlayerName || players.find(player => player.id === event?.targetId)?.nickname;
  const card = event?.card || event?.playedCard;
  const result = event?.reason || event?.resultDescription || event?.description;
  const selection = interactionState === 'TARGETING' && activeCard ? `${activeCard.name} 사용 대상 선택` : interactionState === 'GUESSING' ? '경비병이 지목할 숫자를 선택하세요' : null;
  return <StageContainer aria-label={`덱 ${deckCount}장 남음`}><DeckSlot count={deckCount} setAsideCount={setAsideCount} /><Narration aria-live="polite">{actionError ? <em>{actionError}</em> : selection || (event ? <><strong>{actor || '플레이어'} · {card?.name || card?.value || '카드'} 사용</strong>{event?.targetId && <span>{target ? `${target} 대상` : '대상 지정'}</span>}{result && <em>{result}</em>}</> : <span>현재 행동을 기다리는 중</span>)}</Narration></StageContainer>;
};

const StageContainer = styled.section`
  width:100%; min-width:0; min-height:0; display:grid; grid-template-columns:72px minmax(0, 1fr); align-items:center; justify-content:center; gap:10px; padding:4px 14px; box-sizing:border-box;
  @media (max-height:650px){grid-template-columns:58px minmax(0, 1fr);gap:7px;padding:2px 10px;}
`;
const Narration = styled.div`min-width:0; min-height:42px; max-width:360px; text-align:left; display:flex; flex-direction:column; justify-content:center; gap:3px; color:${THEME.foreground}; font-size:11px; line-height:1.3; strong{font-weight:900;} span{color:${THEME.mutedForeground};} em{font-style:normal;color:${THEME.burgundy};font-weight:800;} @media(max-width:360px){font-size:10px;} @media(max-height:650px){min-height:32px;}`;
