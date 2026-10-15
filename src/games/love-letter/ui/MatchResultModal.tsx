import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { GameAction, ResultDialog } from '../../../shared/GameSurface';
import { THEME } from '../../../shared/theme';

interface MatchResultModalProps {
  isOpen: boolean;
  championName: string;
  localUserId: string;
  targetTokens?: number;
  reason?: string | null;
  onPlayAgain?: () => void;
  onReturnToLobby: () => void;
  players?: PlayerPublic[];
  isHost?: boolean;
  requestError?: string | null;
  isRequesting?: boolean;
}
export const MatchResultModal: React.FC<MatchResultModalProps> = ({
  isOpen, championName, localUserId, targetTokens = 4, reason, onPlayAgain,
  onReturnToLobby, players = [], isHost = false, requestError, isRequesting = false,
}) => {
  const [leaving, setLeaving] = useState(false);
  const leaveRequested = useRef(false);
  useEffect(() => {
    setLeaving(false);
    leaveRequested.current = false;
  }, [isOpen]);
  const leave = () => {
    if (leaveRequested.current) return;
    leaveRequested.current = true;
    setLeaving(true);
    onReturnToLobby();
  };
  const insufficient = reason === 'INSUFFICIENT_HUMANS';
  const standings = [...players].sort((a, b) => b.tokens - a.tokens);
  return <ResultDialog open={isOpen} eyebrow="매치 종료"
    title={insufficient ? '참가자 부족으로 게임 종료' : `${championName} 최종 우승`}
    description={insufficient ? '플레이를 계속할 인간 참가자가 부족해 이 매치는 무효로 종료되었습니다. 점수와 우승자는 기록하지 않습니다.' : `목표 호감도 ${targetTokens}점을 가장 먼저 달성했습니다.`}
    error={requestError}
    actions={<>
      {!insufficient && isHost && onPlayAgain && <GameAction $variant="default" disabled={isRequesting || leaving} aria-busy={isRequesting} onClick={onPlayAgain}>{isRequesting ? '서버에 요청 중…' : '같은 멤버로 새 매치'}</GameAction>}
      <GameAction $variant="ghost" disabled={leaving} aria-busy={leaving} onClick={leave}>{leaving ? '나가는 중…' : '살롱 로비로'}</GameAction>
    </>}>
    {!insufficient && <>
      <Ranking aria-label="최종 호감도 순위">{standings.map(player => {
        const rank = standings.findIndex(candidate => candidate.tokens === player.tokens) + 1;
        const tied = standings.filter(candidate => candidate.tokens === player.tokens).length > 1;
        return <RankRow key={player.id}>
          <span><Rank>{tied ? '공동 ' : ''}{rank}위</Rank>{player.id === localUserId ? '나' : player.nickname}</span>
          <strong>{player.tokens}점</strong>
        </RankRow>;
      })}</Ranking>
      {!isHost && <Waiting>방장만 새 매치를 시작할 수 있습니다.</Waiting>}
    </>}
  </ResultDialog>;
};
const Ranking = styled.ol`list-style:none; margin:0; padding:0; display:grid; gap:8px;`;
const RankRow = styled.li`
  display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 12px;
  border:1px solid ${THEME.border}; border-radius:8px; background:rgba(255,255,255,.7);
  > span {min-width:0;} strong {flex-shrink:0; font-variant-numeric:tabular-nums;}
`;
const Rank = styled.span`display:block; font-size:${THEME.interaction.caption}; color:${THEME.mutedForeground};`;
const Waiting = styled.p`margin:12px 0 0; color:${THEME.mutedForeground};`;
