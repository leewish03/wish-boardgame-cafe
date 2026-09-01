import React from 'react';
import styled from 'styled-components';
import { DeckSlot } from './DeckSlot';
import { GameEventSummary, CardInstance } from '../../../../packages/love-letter-core/src/types';
import { PresentationPhase } from '../machines/presentationMachine';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';

interface ActionStageProps { deckCount:number; lastAction:GameEventSummary|null; interactionState?:string; isOverDropZone?:boolean; activeCard?:CardInstance|null; targetPlayerName?:string|null; onCancelAction?:()=>void; onSelectSelfTarget?:()=>void; onOpenCardHelper?:()=>void; presentationAction?:GameEventEnvelope|null; presentationPhase?:PresentationPhase; }

/** The centre of the table is intentionally only the draw deck. Played cards live at player seats. */
export const ActionStage: React.FC<ActionStageProps> = ({ deckCount }) => <StageContainer aria-label={`덱 ${deckCount}장 남음`}><DeckSlot count={deckCount} /></StageContainer>;

const StageContainer = styled.section`
  flex:1; min-height:50px; display:flex; align-items:center; justify-content:center; padding:4px 0; box-sizing:border-box;
`;
