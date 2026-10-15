import React from 'react';
import styled from 'styled-components';
import { DeckSlot } from './DeckSlot';
import { CardInstance, PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { PresentationPhase } from '../machines/presentationMachine';
import { PresentationAction } from '../presentation/useActionTimeline';
import { THEME } from '../../../shared/theme';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { deriveActionNarrative } from '../presentation/deriveActionNarrative';
import { playerCopy } from './playerCopy';

interface ActionStageProps {
  hideNarration?: boolean;
  deckCount: number;
  setAsideCount?: number;
  players?: PlayerPublic[];
  localUserId: string;
  interactionState?: string;
  actionError?: string | null;
  activeCard?: CardInstance | null;
  targetPlayerId?: string | null;
  selectedGuessName?: string | null;
  presentationAction?: PresentationAction | null;
  presentationPhase?: PresentationPhase;
  isMyTurn?: boolean;
  turnPlayerName?: string;
}

/** The centre of the table explains both the last action and the next legal action. */
export const ActionStage: React.FC<ActionStageProps> = ({
  hideNarration = false,
  deckCount,
  setAsideCount = 0,
  players = [],
  localUserId,
  presentationAction,
  presentationPhase,
  interactionState,
  actionError,
  activeCard,
  targetPlayerId,
  selectedGuessName,
  isMyTurn = false,
  turnPlayerName = '상대',
}) => {
  const narrative = deriveActionNarrative(presentationAction, players, localUserId, targetPlayerId);
  const selection = interactionState === 'TARGETING' && activeCard ? `${activeCard.name}의 대상을 선택하세요` : interactionState === 'GUESSING' ? '경비병이 추측할 카드를 고르세요' : interactionState === 'READY' && activeCard ? `${activeCard.name} 사용 준비 완료` : null;
  const activeDescription = activeCard && (activeCard.description || activeCard.desc || CARD_DEFINITIONS[activeCard.value]?.description);
  const idleMessage = isMyTurn
    ? '2장 중 1장을 사용하고, 남은 1장을 지키세요'
    : `${turnPlayerName}의 차례 · 행동을 기다리는 중`;

  return <StageContainer aria-label={`덱 ${deckCount}장 남음`}>
    <TableObjects><DeckDock><DeckSlot count={deckCount} setAsideCount={setAsideCount} /></DeckDock></TableObjects>
    <Narration aria-live="polite" aria-hidden={hideNarration} style={{ visibility: hideNarration ? 'hidden' : 'visible' }}>{actionError ? <em>{actionError}</em> : (selection && <><strong>{selection}</strong><span>{activeDescription}</span>{targetPlayerId && <em>{playerCopy(players, targetPlayerId, localUserId).name} 대상 {selectedGuessName && `· ${selectedGuessName} 추측`}</em>}</>) || (narrative ? <><strong>{narrative.title}</strong>{narrative.detail && <span>{narrative.detail}</span>}{narrative.result && <em>{narrative.result}</em>}</> : <span>{idleMessage}</span>)}</Narration>
  </StageContainer>;
};

const StageContainer = styled.section`
  position:relative;width:100%; min-width:0; min-height:164px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:12px; box-sizing:border-box;
  @media (max-height:650px){min-height:0;display:grid;grid-template-columns:64px minmax(0,1fr);gap:5px;padding-block:4px;}
`;
const DeckDock = styled.div`min-width:0;display:grid;place-items:center;`;
const TableObjects = styled.div`display:flex;align-items:center;justify-content:center;gap:32px;width:100%;min-height:100px;@media(max-height:650px){min-height:72px;} `;
const Narration = styled.div`
  width:100%; min-width:0; min-height:52px; max-width:460px; padding:10px 13px; box-sizing:border-box;
  text-align:center; display:flex; flex-direction:column; justify-content:center; gap:4px;
  border:1px solid ${THEME.gold}; border-radius:12px; background:rgba(255,253,247,.95);
  box-shadow:0 8px 22px rgba(9,13,22,.10); color:${THEME.foreground}; font-size:11px; line-height:1.35;
  strong{font-weight:900;} span{color:${THEME.mutedForeground};} em{font-style:normal;color:${THEME.burgundy};font-weight:800;}
  @media(max-width:360px){min-height:48px;padding:8px 10px;font-size:10px;border-radius:10px;}
  @media(max-height:650px){min-height:44px;padding:7px 10px;}
`;
