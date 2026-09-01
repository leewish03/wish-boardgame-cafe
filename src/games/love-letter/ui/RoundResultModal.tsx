import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock3, Crown, Users } from 'lucide-react';
import { CardInstance, PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { THEME } from '../../../shared/theme';

interface RoundResultModalProps { isOpen:boolean; roundNumber:number; winnerName:string; winnerReason?:string; winnerTokens?:number; targetTokens?:number; isHost:boolean; onNextRound:()=>void; players?:PlayerPublic[]; winnerIds?:string[]; advanceAt?:number|null; canAdvanceAt?:number|null; isRequesting?:boolean; requestError?:string|null; previousScores?:Record<string,number>; winnerCards?:Record<string,CardInstance>; }
const reasonCopy: Record<string, string> = { LAST_SURVIVOR: '마지막까지 남은 플레이어가 라운드를 가져갔습니다.', DECK_EXHAUSTED: '덱이 소진되어 손패 숫자를 비교했습니다.', TIE_BREAK: '손패와 공개 패 합산으로 동점을 정리했습니다.', FORFEIT: '상대의 기권으로 라운드가 종료되었습니다.' };
export const RoundResultModal: React.FC<RoundResultModalProps> = ({ isOpen, roundNumber, winnerReason, targetTokens=4, isHost, onNextRound, players=[], winnerIds=[], advanceAt, canAdvanceAt, isRequesting=false, requestError, previousScores, winnerCards }) => {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => { if (!advanceAt) return; const tick = () => setSeconds(Math.max(0, Math.ceil((advanceAt - Date.now()) / 1000))); tick(); const id = window.setInterval(tick, 250); return () => clearInterval(id); }, [advanceAt]);
  const winners = players.filter(p => winnerIds.includes(p.id));
  return <AnimatePresence>{isOpen && <Overlay as={motion.div} initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}><Sheet as={motion.section} initial={{ y:30, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:30, opacity:0 }}>
    <Eyebrow>라운드 {roundNumber} 종료</Eyebrow>
    <Title><Crown size={19}/>{winners.map(p => p.nickname).join(', ') || '승자'}{winners.length > 1 ? ' 공동 승리' : ' 승리'}</Title>
    <Reason>{reasonCopy[winnerReason || ''] || winnerReason || '라운드가 종료되었습니다.'}</Reason>
    {winnerCards && winners.length > 0 ? <Reveal>공개 비교 카드 · {winners.map(p => `${p.nickname} ${winnerCards[p.id]?.value ?? '?'}`).join(' · ')}</Reveal> : null}
    <ScoreList>{players.map(p => <ScoreRow key={p.id} $winner={winnerIds.includes(p.id)}><span>{p.nickname}</span><strong>{previousScores ? `${previousScores[p.id] ?? p.tokens} → ` : ''}{p.tokens} / {targetTokens}</strong></ScoreRow>)}</ScoreList>
    {isHost ? <PrimaryButton type="button" disabled={isRequesting || (!!canAdvanceAt && Date.now() < canAdvanceAt)} onClick={onNextRound}>{isRequesting ? '서버에 요청 중…' : !!canAdvanceAt && Date.now() < canAdvanceAt ? `${Math.max(1, Math.ceil((canAdvanceAt - Date.now()) / 1000))}초 후 시작 가능` : '다음 라운드 시작'}</PrimaryButton> : <Waiting><Users size={15}/> 방장이 다음 라운드를 시작합니다{seconds !== null ? <><Clock3 size={14}/> {seconds}초 후 자동 진행</> : null}</Waiting>}
    {requestError && <ErrorText role="alert">{requestError}</ErrorText>}
  </Sheet></Overlay>}</AnimatePresence>;
};
const Overlay = styled.div`position:fixed; inset:0; z-index:1500; display:flex; align-items:flex-end; justify-content:center; padding:12px; box-sizing:border-box; background:rgba(9,13,22,.68); backdrop-filter:blur(6px);`;
const Sheet = styled.div`width:min(480px,100%); max-height:88dvh; overflow:auto; box-sizing:border-box; padding:20px; border:1.5px solid ${THEME.gold}; border-radius:18px 18px 10px 10px; background:#fff; background-image:${THEME.gradients.marbleSlab}; text-align:center;`;
const Eyebrow = styled.div`font-size:10px; font-weight:900; letter-spacing:.1em; color:${THEME.goldAntique};`;
const Title = styled.h2`margin:7px 0 4px; display:flex; justify-content:center; align-items:center; gap:6px; font-family:${THEME.font.serif}; font-size:19px; color:${THEME.foreground};`;
const Reason = styled.p`margin:0 0 14px; font-size:12px; color:${THEME.mutedForeground};`;
const Reveal = styled.p`margin:-7px 0 12px; font-size:10.5px; color:${THEME.burgundy}; font-weight:800;`;
const ScoreList = styled.div`display:flex; flex-direction:column; gap:4px; margin-bottom:14px;`;
const ScoreRow = styled.div<{ $winner:boolean }>`display:flex; justify-content:space-between; padding:7px 9px; border-radius:7px; background:${p => p.$winner ? '#fff7df' : 'rgba(255,255,255,.7)'}; border:1px solid ${p => p.$winner ? THEME.gold : THEME.border}; font-size:11px; color:${THEME.foreground};`;
const PrimaryButton = styled.button`width:100%; height:42px; border:1px solid ${THEME.goldAntique}; border-radius:8px; background:${THEME.gradients.goldShimmer}; color:${THEME.foreground}; font:900 13px ${THEME.font.serif}; cursor:pointer; &:disabled{opacity:.6;cursor:wait;}`;
const Waiting = styled.div`display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:5px; padding:10px; border:1px solid ${THEME.border}; border-radius:8px; font-size:11px; color:${THEME.mutedForeground};`;
const ErrorText = styled.p`margin:8px 0 0; color:${THEME.destructive}; font-size:11px; font-weight:700;`;
