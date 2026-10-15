import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { CardInstance, PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { GameAction, ResultDialog } from '../../../shared/GameSurface';
import { THEME } from '../../../shared/theme';

interface RoundResultModalProps {
  isOpen: boolean;
  roundNumber: number;
  winnerName: string;
  localUserId: string;
  winnerReason?: string;
  winnerTokens?: number;
  targetTokens?: number;
  isHost: boolean;
  onNextRound: () => void;
  onLeave?: () => void;
  players?: PlayerPublic[];
  winnerIds?: string[];
  advanceAt?: number | null;
  canAdvanceAt?: number | null;
  isRequesting?: boolean;
  requestError?: string | null;
  previousScores?: Record<string, number>;
  winnerCards?: Record<string, CardInstance>;
}
const reasonCopy: Record<string, string> = {
  LAST_SURVIVOR: '마지막까지 남은 플레이어가 라운드를 가져갔습니다.',
  DECK_EXHAUSTED: '덱이 소진되어 손패 숫자를 비교했습니다.',
  TIE_BREAK: '손패와 공개 패 합산으로 동점을 정리했습니다.',
  FORFEIT: '상대의 기권으로 라운드가 종료되었습니다.',
};

export const RoundResultModal: React.FC<RoundResultModalProps> = ({
  isOpen, roundNumber, winnerName, localUserId, winnerReason, targetTokens = 4,
  isHost, onNextRound, onLeave, players = [], winnerIds = [], advanceAt, canAdvanceAt,
  isRequesting = false, requestError, previousScores, winnerCards,
}) => {
  const [now, setNow] = useState(Date.now);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveRequested = useRef(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const leaveButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (isOpen && confirmLeave) cancelButton.current?.focus();
    else if (isOpen && wasConfirming.current) leaveButton.current?.focus();
    wasConfirming.current = confirmLeave;
  }, [isOpen, confirmLeave]);
  useEffect(() => {
    if (!isOpen || (!advanceAt && !canAdvanceAt)) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [isOpen, advanceAt, canAdvanceAt]);
  useEffect(() => {
    setConfirmLeave(false);
    setLeaving(false);
    leaveRequested.current = false;
  }, [isOpen, roundNumber]);
  const winners = players.filter(player => winnerIds.includes(player.id));
  const displayName = (player: PlayerPublic) => player.id === localUserId ? '나' : player.nickname;
  const locked = Boolean(canAdvanceAt && now < canAdvanceAt);
  const seconds = advanceAt ? Math.max(0, Math.ceil((advanceAt - now) / 1000)) : null;
  const confirmExit = () => {
    if (leaveRequested.current) return;
    leaveRequested.current = true;
    setLeaving(true);
    onLeave?.();
  };
  return <div onKeyDown={event => {
    if (event.key === 'Escape' && confirmLeave && !leaving) {
      event.preventDefault();
      event.stopPropagation();
      setConfirmLeave(false);
    }
  }}><ResultDialog open={isOpen} eyebrow={`라운드 ${roundNumber} 종료`}
    title={confirmLeave ? '매치를 떠나시겠어요?' : winners.length > 1 ? `${winners.length}명 공동 승리` : '라운드 승리'}
    description={confirmLeave ? '진행 중인 매치에서 기권하고 살롱 로비로 돌아갑니다.' : reasonCopy[winnerReason || ''] || winnerReason || '라운드가 종료되었습니다.'}
    error={requestError}
    actions={confirmLeave ? <>
      <GameAction ref={cancelButton} $variant="ghost" disabled={leaving} onClick={() => setConfirmLeave(false)}>취소</GameAction>
      <GameAction $variant="default" disabled={leaving} aria-busy={leaving} onClick={confirmExit}>{leaving ? '나가는 중…' : '기권하고 나가기'}</GameAction>
    </> : <>
      {isHost ? <GameAction $variant="default" disabled={isRequesting || locked} aria-busy={isRequesting} onClick={onNextRound}>
        {isRequesting ? '서버에 요청 중…' : locked ? `${Math.max(1, Math.ceil(((canAdvanceAt || 0) - now) / 1000))}초 후 시작 가능` : '다음 라운드 시작'}
      </GameAction> : <Waiting>방장이 다음 라운드를 시작합니다.{seconds !== null && ` ${seconds}초 후 자동 진행`}</Waiting>}
      {onLeave && <GameAction ref={leaveButton} $variant="ghost" onClick={() => setConfirmLeave(true)}>살롱 로비로</GameAction>}
    </>}>
    {players.length === 0 && <Reveal>{winnerName}</Reveal>}
    <ScoreList aria-label="라운드 호감도">{players.map(player => <ScoreRow key={player.id} $winner={winnerIds.includes(player.id)}>
      <span>{displayName(player)}{winnerIds.includes(player.id) && <Winner>라운드 승리{winnerCards?.[player.id] && ` · 공개 비교 카드 ${winnerCards[player.id].value}`}</Winner>}</span>
      <strong>{previousScores ? `${previousScores[player.id] ?? player.tokens} → ` : ''}{player.tokens} / {targetTokens}</strong>
    </ScoreRow>)}</ScoreList>
  </ResultDialog></div>;
};
const Reveal = styled.p`margin:0 0 12px; color:${THEME.burgundy}; font-weight:700;`;
const ScoreList = styled.ul`list-style:none; margin:0; padding:0; display:grid; gap:8px;`;
const ScoreRow = styled.li<{ $winner: boolean }>`
  display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 12px;
  border:1px solid ${p => p.$winner ? THEME.gold : THEME.border}; border-radius:8px;
  background:${p => p.$winner ? '#fff7df' : 'rgba(255,255,255,.7)'};
  > span {min-width:0;} strong {flex-shrink:0; font-variant-numeric:tabular-nums;}
`;
const Winner = styled.span`display:block; font-size:${THEME.interaction.caption}; color:${THEME.burgundy};`;
const Waiting = styled.p`margin:0; color:${THEME.mutedForeground};`;
