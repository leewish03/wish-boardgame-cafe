import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Menu, Wifi, WifiOff } from 'lucide-react';
import { THEME } from '../../../shared/theme';
import GameScreenControls from '../../../shared/GameScreenControls';

export type ClockMode = 'RUNNING' | 'PRESENTING' | 'PAUSED' | 'DISCONNECTED' | 'HIDDEN';
interface GameHudProps { roundNumber:number; myTokens?:number; targetTokens?:number; turnPlayerNickname:string; isMyTurn:boolean; isConnected?:boolean; statusLabel:string; leftLabel?:React.ReactNode; turnExpiresAt?:number; turnTimeoutSeconds?:number; serverClockOffsetMs?:number; clockMode?:ClockMode; onOpenSettings:()=>void; }

export const remainingSeconds = (turnExpiresAt?:number, turnTimeoutSeconds?:number, serverClockOffsetMs=0) => {
  if (!turnExpiresAt || !turnTimeoutSeconds || turnTimeoutSeconds <= 0) return null;
  return Math.min(turnTimeoutSeconds, Math.max(0, Math.ceil((turnExpiresAt - (Date.now() + serverClockOffsetMs)) / 1000)));
};

export const GameHud: React.FC<GameHudProps> = ({ roundNumber, targetTokens, statusLabel, leftLabel, turnExpiresAt, turnTimeoutSeconds, serverClockOffsetMs=0, clockMode='RUNNING', isConnected=true, onOpenSettings }) => {
  const [secondsLeft, setSecondsLeft] = useState(() => remainingSeconds(turnExpiresAt, turnTimeoutSeconds, serverClockOffsetMs));

  useEffect(() => {
    const refresh = () => setSecondsLeft(remainingSeconds(turnExpiresAt, turnTimeoutSeconds, serverClockOffsetMs));
    refresh();
    if (!turnExpiresAt || !turnTimeoutSeconds || turnTimeoutSeconds <= 0) return;
    const intervalId = window.setInterval(refresh, 500);
    return () => window.clearInterval(intervalId);
  }, [turnExpiresAt, turnTimeoutSeconds, serverClockOffsetMs]);

  const hasTimeLimit = Boolean(turnTimeoutSeconds && turnTimeoutSeconds > 0);
  const timerLabel = clockMode === 'PRESENTING' ? '행동 연출 중' : clockMode === 'PAUSED' ? '게임 일시 정지' : clockMode === 'DISCONNECTED' ? '연결 복구 중' : hasTimeLimit ? `${secondsLeft ?? 0}초 남음` : '턴 제한 없음';
  const clockText = clockMode === 'PRESENTING' ? '연출 중' : clockMode === 'PAUSED' ? '일시 정지' : clockMode === 'DISCONNECTED' ? '—' : clockMode === 'HIDDEN' ? '—' : hasTimeLimit ? `${secondsLeft ?? 0}초` : '∞';

  return <HudContainer>
    <RoundInfo>{leftLabel || <>라운드 {roundNumber} <span>· 목표 {targetTokens}</span></>}</RoundInfo><TurnStatus role="status" aria-live="polite">{statusLabel}</TurnStatus>
    <TurnClock $urgent={clockMode === 'RUNNING' && hasTimeLimit && (secondsLeft ?? 0) <= 10} title={timerLabel} aria-label={timerLabel}>{clockText}</TurnClock>
    <RightGroup>{isConnected ? <Wifi size={14} aria-label="실시간 연결됨"/> : <WifiOff size={14} aria-label="연결 끊김"/>}<GameScreenControls/><MenuButton type="button" onClick={onOpenSettings} aria-label="게임 메뉴"><Menu size={17}/></MenuButton></RightGroup>
  </HudContainer>;
};
const HudContainer = styled.header`min-height:48px; display:flex; align-items:center; gap:8px; padding:0 9px; box-sizing:border-box; background:rgba(255,255,255,.96); background-image:${THEME.gradients.marbleSlab}; border-bottom:1px solid ${THEME.border}; color:${THEME.foreground}; flex-shrink:0; @media(max-width:560px){display:grid;grid-template-columns:minmax(0,1fr) auto auto;column-gap:8px;row-gap:0;padding-bottom:6px;}`;
const RoundInfo = styled.div`font-family:${THEME.font.serif}; font-size:11px; font-weight:900; letter-spacing:.03em; span{color:${THEME.mutedForeground}; font-family:${THEME.font.sans}; font-weight:700;}`;
const TurnStatus = styled.div`min-width:0; flex:1; color:${THEME.burgundy}; font-size:${THEME.interaction.caption}; font-weight:850; line-height:1.4; @media(max-width:560px){grid-row:2;grid-column:1/-1;}`;
const TurnClock = styled.span<{$urgent:boolean}>`flex:0 0 auto; min-width:31px; padding:3px 5px; border:1px solid ${p => p.$urgent ? THEME.burgundy : THEME.border}; border-radius:6px; color:${p => p.$urgent ? THEME.burgundy : THEME.primary}; background:${p => p.$urgent ? '#fff1f2' : '#fff'}; text-align:center; font-size:10px; font-weight:900; font-variant-numeric:tabular-nums;`;
const RightGroup = styled.div`margin-left:auto;display:flex; align-items:center; gap:8px; color:${THEME.mutedForeground};`;
const MenuButton = styled.button`display:grid; place-items:center; width:${THEME.interaction.touchTarget}; height:${THEME.interaction.touchTarget}; padding:0; border:1px solid ${THEME.border}; border-radius:7px; color:${THEME.primary}; background:#fff; cursor:pointer;&:focus-visible{outline:2px solid ${THEME.burgundy};outline-offset:2px;}`;
