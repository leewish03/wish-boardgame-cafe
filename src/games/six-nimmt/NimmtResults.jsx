import React from 'react';
import styled from 'styled-components';
import { GameAction, ResultDialog } from '../../shared/GameSurface';
import { THEME } from '../../shared/theme';

const Standings = styled.ol`
  list-style:none;margin:0;padding:0;display:grid;gap:8px;
  li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;padding:12px 0;border-bottom:1px solid ${THEME.border};}
  li:last-child{border-bottom:0;}
  strong{display:block;font-size:${THEME.interaction.body};overflow-wrap:anywhere;}
  small{display:block;font-size:${THEME.interaction.caption};color:${THEME.mutedForeground};}
  [data-score]{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
  [data-winner=true]{color:${THEME.burgundy};}
`;

export default function NimmtResults({open,game,isHost,locked,pending,error,connectionNotice,onAdvance,onLeave}) {
  const final=game.matchState==='GAME_OVER';
  const players=[...game.players].sort((a,b)=>a.score-b.score);
  return <ResultDialog open={open} title={final?'최종 결과':'라운드 결과'}
    eyebrow={`6 nimmt! · ${game.roundNumber}라운드`}
    description={final?'가장 낮은 누적 벌점으로 승부를 마쳤습니다.':'이번 판 벌점을 합산했습니다. 낮은 누적 벌점이 앞섭니다.'}
    error={error}
    actions={<>
      {connectionNotice&&<p role="status">{connectionNotice}</p>}
      {isHost?<GameAction disabled={locked||pending} aria-busy={pending} onClick={onAdvance}>{pending?'준비 중…':final?'다시 플레이':'다음 라운드'}</GameAction>:<p role="status">방장이 {final?'새 게임을':'다음 라운드를'} 시작할 때까지 기다립니다.</p>}
      <GameAction $variant="ghost" onClick={onLeave}>로비로 나가기</GameAction>
    </>}>
    <Standings aria-label="벌점 순위">{players.map(player=>{
      const rank=players.findIndex(p=>p.score===player.score)+1;
      const tied=players.filter(p=>p.score===player.score).length>1;
      const winner=final&&game.outcome?.winnerIds.includes(player.id);
      return <li key={player.id}>
        <div><small data-winner={winner}>{tied?'공동 ':''}{rank}위{winner?' · 승리':''}</small><strong>{player.nickname}</strong></div>
        <div data-score><strong>누적 {player.score}</strong><small>이번 판 +{player.roundScore}</small></div>
      </li>;
    })}</Standings>
  </ResultDialog>;
}
