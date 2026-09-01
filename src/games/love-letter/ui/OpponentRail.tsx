import React from 'react';
import styled from 'styled-components';
import { PlayerSeat } from './PlayerSeat';
import { PlayerPublic, PlayerId } from '../../../../packages/love-letter-core/src/types';

interface OpponentRailProps { opponents: PlayerPublic[]; currentTurnPlayerId: PlayerId | null; targetablePlayerIds: PlayerId[]; selectedTargetId: PlayerId | null; speakingUsers?: Record<string, boolean>; userSubtitles?: Record<string, { text:string; timestamp:number }>; onSelectTarget:(id:PlayerId)=>void; onInspectDiscards?:(id:PlayerId)=>void; }
export const OpponentRail: React.FC<OpponentRailProps> = ({ opponents, currentTurnPlayerId, targetablePlayerIds, selectedTargetId, speakingUsers={}, userSubtitles={}, onSelectTarget, onInspectDiscards }) => (
  <OpponentGrid $count={opponents.length}>
    {opponents.map((opp, index) => <GridCell key={opp.id} $index={index} $count={opponents.length}>
      <PlayerSeat player={opp} isCurrentTurn={currentTurnPlayerId===opp.id} isTargetable={targetablePlayerIds.includes(opp.id)} isSelectedTarget={selectedTargetId===opp.id} isSelf={false} isSpeaking={!!speakingUsers[opp.id]} subtitle={userSubtitles[opp.id]} onClickTarget={() => onSelectTarget(opp.id)} onInspectDiscards={() => onInspectDiscards?.(opp.id)} />
    </GridCell>)}
  </OpponentGrid>
);
const OpponentGrid = styled.div<{ $count:number }>`
  width:100%; display:grid; grid-template-columns:repeat(${p => Math.min(3, Math.max(1,p.$count))}, minmax(0, 1fr)); gap:5px; padding:5px 7px 2px; box-sizing:border-box; flex-shrink:0;
  @media (max-width:360px){gap:3px; padding:3px 4px 1px;}
`;
const GridCell = styled.div<{ $index:number; $count:number }>`
  min-width:0;
  ${p => p.$count === 4 && p.$index === 3 ? 'grid-column:2;' : ''}
  ${p => p.$count === 5 && p.$index === 3 ? 'grid-column:1 / span 2; margin-left:25%; margin-right:-25%;' : ''}
`;
