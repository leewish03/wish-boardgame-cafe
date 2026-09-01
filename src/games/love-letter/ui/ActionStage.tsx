import React from 'react';
import styled from 'styled-components';
import { DeckSlot } from './DeckSlot';
import { GameEventSummary, CardInstance } from '../../../../packages/love-letter-core/src/types';
import { PresentationPhase } from '../machines/presentationMachine';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { THEME } from '../../../shared/theme';
import { PlayerPublic } from '../../../../packages/love-letter-core/src/types';

interface ActionStageProps { deckCount:number; setAsideCount?:number; players?:PlayerPublic[]; lastAction:GameEventSummary|null; interactionState?:string; isOverDropZone?:boolean; activeCard?:CardInstance|null; targetPlayerName?:string|null; onCancelAction?:()=>void; onSelectSelfTarget?:()=>void; onOpenCardHelper?:()=>void; presentationAction?:GameEventEnvelope|null; presentationPhase?:PresentationPhase; }

/** The centre of the table is intentionally only the draw deck. Played cards live at player seats. */
export const ActionStage: React.FC<ActionStageProps> = ({ deckCount, setAsideCount=0, players=[], lastAction, presentationAction, interactionState, activeCard, targetPlayerName }) => {
  const event: any = presentationAction?.event || lastAction;
  const actor = event?.actorName || event?.actorNickname || players.find(player => player.id === event?.actorId)?.nickname || event?.actorId;
  const target = targetPlayerName || players.find(player => player.id === event?.targetId)?.nickname;
  const card = event?.card || event?.playedCard;
  const result = event?.reason || event?.resultDescription || event?.description;
  const selection = interactionState === 'TARGETING' && activeCard ? `${activeCard.name}을(를) 사용할 대상 선택` : interactionState === 'GUESSING' ? '경비병이 지목할 숫자를 선택하세요' : null;
  return <StageContainer aria-label={`덱 ${deckCount}장 남음`}><DeckSlot count={deckCount} setAsideCount={setAsideCount} /><Narration aria-live="polite">{selection || (event ? <><strong>{actor || '플레이어'} · {card?.name || card?.value || '카드'} 사용</strong>{event?.targetId && <span>{target ? `${target} 대상` : '대상 지정'}</span>}{result && <em>{result}</em>}</> : <span>현재 행동을 기다리는 중</span>)}</Narration></StageContainer>;
};

const StageContainer = styled.section`
  flex:1; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:9px; padding:2px 12px; box-sizing:border-box;
`;
const Narration = styled.div`min-height:30px; max-width:min(310px, 94vw); text-align:center; display:flex; flex-direction:column; gap:2px; color:${THEME.foreground}; font-size:11px; line-height:1.25; strong{font-weight:900;} span{color:${THEME.mutedForeground};} em{font-style:normal;color:${THEME.burgundy};font-weight:800;}`;
