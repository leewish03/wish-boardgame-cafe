import React from 'react';
import styled from 'styled-components';
import { DeckSlot } from './DeckSlot';
import { CardInstance, GameEventSummary, PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { PresentationPhase } from '../machines/presentationMachine';
import { PresentationAction } from '../presentation/useActionTimeline';
import { THEME } from '../../../shared/theme';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { useTableAnchor } from '../presentation/TableAnchorRegistry';
import { buildPhysicalSequence } from '../presentation/physicalSequence';
import { playerCopy } from './playerCopy';

interface ActionStageProps {
  deckCount: number;
  setAsideCount?: number;
  players?: PlayerPublic[];
  localUserId: string;
  lastAction: GameEventSummary | null;
  interactionState?: string;
  actionError?: string | null;
  activeCard?: CardInstance | null;
  targetPlayerId?: string | null;
  selectedGuessName?: string | null;
  canConfirm?: boolean;
  onConfirmAction?: () => void;
  onCancelAction?: () => void;
  presentationAction?: PresentationAction | null;
  presentationPhase?: PresentationPhase;
}

/** The centre of the table explains both the last action and the next legal action. */
export const ActionStage: React.FC<ActionStageProps> = ({
  deckCount,
  setAsideCount = 0,
  players = [],
  localUserId,
  lastAction,
  presentationAction,
  presentationPhase,
  interactionState,
  actionError,
  activeCard,
  targetPlayerId,
  selectedGuessName,
  canConfirm = false,
  onConfirmAction,
  onCancelAction,
}) => {
  const step = buildPhysicalSequence(presentationAction?.presentationEvents || [])[presentationAction?.presentationIndex || 0];
  const controlsAnchor = useTableAnchor('table','review-controls');
  const played = presentationAction?.presentationEvents.find(envelope => (envelope.event as any).type === 'CARD_PLAYED');
  const targetEvent = step?.kind !== 'PLAY' ? step : null;
  const event: any = presentationAction?.event || lastAction;
  const actionEvent: any = played?.event || event;
  const actorId = actionEvent?.actorId || step?.actorId;
  const actor = playerCopy(players, actorId, localUserId);
  const targetId = targetPlayerId || targetEvent?.targetId || actionEvent?.targetId;
  const target = targetId ? playerCopy(players, targetId, localUserId) : null;
  const card = actionEvent?.card || actionEvent?.playedCard;
  const result = step?.kind === 'RESULT_DWELL' ? (event?.description || event?.presentation?.description) : null;
  const selection = interactionState === 'TARGETING' && activeCard ? `${activeCard.name}의 대상을 선택하세요` : interactionState === 'GUESSING' ? '경비병이 추측할 카드를 고르세요' : interactionState === 'READY' && activeCard ? `${activeCard.name} 사용 준비 완료` : null;
  const hasTarget = Boolean(targetId);
  const activeDescription = activeCard && (activeCard.description || activeCard.desc || CARD_DEFINITIONS[activeCard.value]?.description);

  return <StageContainer aria-label={`덱 ${deckCount}장 남음`}>
    <TableObjects><DeckDock><DeckSlot count={deckCount} setAsideCount={setAsideCount} /></DeckDock></TableObjects>
    <Narration aria-live="polite">{actionError ? <em>{actionError}</em> : (selection && <><strong>{selection}</strong>{targetPlayerId && <span>{playerCopy(players, targetPlayerId, localUserId).name} 대상 {selectedGuessName && `· ${selectedGuessName} 추측`}</span>}</>) || (event ? <><strong>{actor.name} · {card?.name || card?.value || '카드'} 사용</strong>{hasTarget && <span>{target ? `${target.name} 대상` : '대상 지정'}</span>}{result && <em>{result}</em>}</> : <span>카드를 선택해 행동을 준비하세요</span>)}<div ref={controlsAnchor}/></Narration>
    {activeCard && <ActionControls><CancelButton type="button" onClick={onCancelAction} disabled={interactionState === 'SUBMITTING'}>취소</CancelButton><ConfirmButton type="button" disabled={!canConfirm} onClick={onConfirmAction}>{interactionState === 'SUBMITTING' ? '전달 중…' : '이 카드 사용'}</ConfirmButton></ActionControls>}
  </StageContainer>;
};

const StageContainer = styled.section`
  width:100%; min-width:0; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:12px; box-sizing:border-box;
  @media (max-height:650px){display:grid;grid-template-columns:64px minmax(0,1fr);gap:5px;padding-block:4px;}
`;
const DeckDock = styled.div`min-width:0;display:grid;place-items:center;`;
const TableObjects = styled.div`display:flex;align-items:center;justify-content:center;gap:32px;width:100%;min-height:100px;@media(max-height:650px){min-height:72px;} `;
const ReviewPlace = styled.div`width:86px;height:124px;`;
const Narration = styled.div`
  width:100%; min-width:0; min-height:52px; max-width:460px; padding:10px 13px; box-sizing:border-box;
  text-align:center; display:flex; flex-direction:column; justify-content:center; gap:4px;
  border:1px solid ${THEME.gold}; border-radius:12px; background:rgba(255,253,247,.95);
  box-shadow:0 8px 22px rgba(9,13,22,.10); color:${THEME.foreground}; font-size:11px; line-height:1.35;
  strong{font-weight:900;} span{color:${THEME.mutedForeground};} em{font-style:normal;color:${THEME.burgundy};font-weight:800;}
  @media(max-width:360px){min-height:48px;padding:8px 10px;font-size:10px;border-radius:10px;}
  @media(max-height:650px){min-height:44px;padding:7px 10px;}
`;
const SelectionCard = styled.div`
  width:min(460px, 100%); padding:9px 12px; box-sizing:border-box; display:flex; flex-direction:column; gap:3px; text-align:center;
  background:rgba(255,253,247,.96); border:1px solid ${THEME.gold}; border-radius:12px; color:${THEME.foreground};
  strong{font-family:${THEME.font.serif}; font-size:14px;} span{font-size:11px; line-height:1.35; color:${THEME.mutedForeground};} b{font-size:11px; color:${THEME.burgundy};}
`;
const ActionControls = styled.div`width:min(460px, 100%); display:grid; grid-template-columns:1fr 2fr; gap:8px;grid-column:1/-1;`;
const CancelButton = styled.button`height:42px; border:1px solid ${THEME.border}; border-radius:9px; background:#fff; color:${THEME.foreground}; font:800 12px ${THEME.font.sans}; cursor:pointer; &:disabled{opacity:.55;cursor:wait;}`;
const ConfirmButton = styled.button`height:42px; border:1px solid ${THEME.goldAntique}; border-radius:9px; background:${THEME.gradients.obsidianButton}; color:#fff; font:900 13px ${THEME.font.serif}; cursor:pointer; &:disabled{opacity:.45;cursor:not-allowed;}`;
