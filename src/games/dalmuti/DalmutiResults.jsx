import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { GameAction, ResultDialog } from '../../shared/GameSurface';
import { THEME } from '../../shared/theme';

export function DalmutiResults({ game, presenting = false, isHost, locked, submitting, error, connectionNotice, onAdvance, onRematch, onLeave }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const cancelRef = useRef(null);
  const leaveRef = useRef(null);
  const wasConfirming = useRef(false);
  const final = game.matchState === 'GAME_OVER';
  const open = confirmLeave || (!presenting && (game.matchState === 'ROUND_END' || final));
  useEffect(() => {
    if (confirmLeave) cancelRef.current?.focus();
    else if (wasConfirming.current) leaveRef.current?.focus();
    wasConfirming.current = confirmLeave;
  }, [confirmLeave]);
  const leave = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    onLeave?.({ immediate: true });
  };
  const playerById = new Map(game.players.map(player => [player.id, player]));
  const order = final ? [...game.players].sort((a, b) => b.score - a.score).map(player => player.id) : game.outcome?.finishOrder || [];
  return <div onKeyDown={event => {
    if (confirmLeave && !leaving && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setConfirmLeave(false); }
  }}><ResultDialog open={open}
    title={confirmLeave ? '게임을 나갈까요?' : final ? '최종 계급전 결과' : `${game.roundNumber}라운드 결과`}
    eyebrow="달무티 · 계급전"
    description={confirmLeave ? '진행 중인 게임에서 나가면 기권 처리됩니다.' : final ? '누적 점수로 최종 순위를 정했습니다.' : '새 신분으로 다음 라운드를 준비합니다.'}
    error={confirmLeave ? undefined : error}
    actions={confirmLeave ? <>
      <GameAction ref={cancelRef} $variant="secondary" disabled={leaving} onClick={() => setConfirmLeave(false)}>취소</GameAction>
      <GameAction $variant="destructive" disabled={leaving} aria-busy={leaving} onClick={leave}>{leaving ? '나가는 중…' : '기권하고 나가기'}</GameAction>
    </> : <>
      {connectionNotice && <p role="status">{connectionNotice}</p>}
      {isHost ? <GameAction disabled={locked || submitting || leaving} aria-busy={submitting} onClick={final ? onRematch : onAdvance}>{submitting ? '서버에 요청 중…' : final ? '같은 멤버로 새 매치' : '바로 다음 라운드'}</GameAction>
        : <p role="status">{final ? '방장이 새 매치를 시작할 때까지 기다립니다.' : '잠시 후 다음 라운드가 시작됩니다. 방장이 바로 시작할 수도 있습니다.'}</p>}
      <GameAction ref={leaveRef} $variant="ghost" disabled={leaving} onClick={final ? leave : () => setConfirmLeave(true)}>{leaving ? '나가는 중…' : '살롱 로비로'}</GameAction>
    </>}>
    {confirmLeave ? <p>이 자리는 AI가 이어받습니다. 취소하면 테이블에 남습니다.</p> : <>
      <Ranking aria-label="계급 순위">{order.map((id, index) => {
        const player = playerById.get(id);
        const rank = final ? game.players.filter(candidate => candidate.score > player.score).length + 1 : index + 1;
        const winner = final && game.outcome?.winnerIds.includes(id);
        return <li key={id}><b>{rank}위</b><div><strong>{player.nickname}</strong><span>{final ? '마지막 라운드' : '이번 라운드'} · {player.role}{winner ? ' · 우승' : ''}</span></div><Score>{player.score}점</Score></li>;
      })}</Ranking>
    </>}
  </ResultDialog></div>;
}

const Ranking = styled.ol`list-style:none;margin:0;padding:0;display:grid;gap:${THEME.interaction.gap};li{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid ${THEME.border};}li:last-child{border:0;}b{color:${THEME.goldAntique};}strong{display:block;font-size:${THEME.interaction.body};overflow-wrap:anywhere;}span{font-size:${THEME.interaction.caption};color:${THEME.mutedForeground};}`;
const Score = styled.strong`color:${THEME.burgundy};white-space:nowrap;font-variant-numeric:tabular-nums;`;
