import React from 'react';
import styled from 'styled-components';
import { PlayerSeat } from './PlayerSeat';
import { PlayerPublic, PlayerId } from '../../../../packages/love-letter-core/src/types';

interface OpponentRailProps {
  opponents: PlayerPublic[];
  currentTurnPlayerId: PlayerId | null;
  targetablePlayerIds: PlayerId[];
  selectedTargetId: PlayerId | null;
  onSelectTarget: (playerId: PlayerId) => void;
  onInspectDiscards?: (playerId: PlayerId) => void;
}

export const OpponentRail: React.FC<OpponentRailProps> = ({
  opponents,
  currentTurnPlayerId,
  targetablePlayerIds,
  selectedTargetId,
  onSelectTarget,
  onInspectDiscards,
}) => {
  return (
    <RailContainer>
      {opponents.map(opp => (
        <PlayerSeat
          key={opp.id}
          player={opp}
          isCurrentTurn={currentTurnPlayerId === opp.id}
          isTargetable={targetablePlayerIds.includes(opp.id)}
          isSelectedTarget={selectedTargetId === opp.id}
          isSelf={false}
          onClickTarget={() => onSelectTarget(opp.id)}
          onInspectDiscards={() => onInspectDiscards && onInspectDiscards(opp.id)}
        />
      ))}
    </RailContainer>
  );
};

const RailContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;
