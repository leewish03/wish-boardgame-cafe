import React from 'react';
import styled from 'styled-components';
import { OpponentZone } from './PlayerZone';
import { PlayerPublic, PlayerId } from '../../../../packages/love-letter-core/src/types';

interface OpponentRailProps { opponents: PlayerPublic[]; currentTurnPlayerId: PlayerId | null; targetablePlayerIds: PlayerId[]; selectedTargetId: PlayerId | null; speakingUsers?: Record<string, boolean>; userSubtitles?: Record<string, { text:string; timestamp:number }>; onSelectTarget:(id:PlayerId)=>void; onInspectDiscards?:(id:PlayerId)=>void; }
export const OpponentRail: React.FC<OpponentRailProps> = ({ opponents, currentTurnPlayerId, targetablePlayerIds, selectedTargetId, speakingUsers={}, userSubtitles={}, onSelectTarget, onInspectDiscards }) => (
  <OpponentGrid>
    {opponents.map(opp => <OpponentZone key={opp.id} player={opp} isCurrentTurn={currentTurnPlayerId===opp.id} isTargetable={targetablePlayerIds.includes(opp.id)} isSelectedTarget={selectedTargetId===opp.id} isSpeaking={!!speakingUsers[opp.id]} onSelect={() => onSelectTarget(opp.id)} onInspect={() => onInspectDiscards?.(opp.id)} />)}
  </OpponentGrid>
);
const OpponentGrid = styled.div`
  width:100%; min-width:0; max-width:100%; display:flex; flex-wrap:wrap; justify-content:center; align-content:start; gap:4px 5px; padding:4px 5px 1px; box-sizing:border-box; overflow:hidden;
  @media (max-width:360px){gap:2px 3px;padding:3px 3px 0;}
`;
