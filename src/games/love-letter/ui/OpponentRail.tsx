import React from 'react';
import styled from 'styled-components';
import { OpponentZone } from './PlayerZone';
import { PlayerPublic, PlayerId } from '../../../../packages/love-letter-core/src/types';

interface OpponentRailProps { opponents: PlayerPublic[]; currentTurnPlayerId: PlayerId | null; targetablePlayerIds: PlayerId[]; selectedTargetId: PlayerId | null; presentationAction?: { event?: any } | null; speakingUsers?: Record<string, boolean>; userSubtitles?: Record<string, { text:string; timestamp:number }>; onSelectTarget:(id:PlayerId)=>void; onInspectDiscards?:(id:PlayerId)=>void; }
export const OpponentRail: React.FC<OpponentRailProps> = ({ opponents, currentTurnPlayerId, targetablePlayerIds, selectedTargetId, presentationAction, speakingUsers={}, userSubtitles={}, onSelectTarget, onInspectDiscards }) => (
  <OpponentGrid data-opponent-count={opponents.length}>
    {opponents.map(opp => <OpponentZone key={opp.id} player={opp} isCurrentTurn={currentTurnPlayerId===opp.id} isTargetable={targetablePlayerIds.includes(opp.id)} isSelectedTarget={selectedTargetId===opp.id} isSpeaking={!!speakingUsers[opp.id]} presentationAction={presentationAction} onSelect={() => onSelectTarget(opp.id)} onInspect={() => onInspectDiscards?.(opp.id)} />)}
  </OpponentGrid>
);
const OpponentGrid = styled.div`
  width:100%; min-width:0; max-width:680px; margin:0 auto; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); align-content:start; gap:5px; padding:5px 7px 2px; box-sizing:border-box; overflow:visible;
  &[data-opponent-count="1"]{grid-template-columns:minmax(0,280px);justify-content:center;}
  &[data-opponent-count="2"], &[data-opponent-count="4"]{grid-template-columns:repeat(2,minmax(0,1fr));}
  @media (max-width:360px){gap:3px;padding:3px 4px 1px;}
  @media (max-height:650px){gap:3px;padding-top:3px;}
`;
