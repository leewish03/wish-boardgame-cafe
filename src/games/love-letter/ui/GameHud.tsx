import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Menu, Wifi, WifiOff } from 'lucide-react';
import { THEME } from '../../../shared/theme';

export type ClockMode = 'RUNNING' | 'PRESENTING' | 'PAUSED' | 'DISCONNECTED' | 'HIDDEN';
interface GameHudProps { roundNumber:number; myTokens:number; targetTokens:number; turnPlayerNickname:string; isMyTurn:boolean; isConnected?:boolean; statusLabel:string; turnExpiresAt?:number; turnTimeoutSeconds?:number; serverClockOffsetMs?:number; clockMode?:ClockMode; onOpenSettings:()=>void; }

export const remainingSeconds = (turnExpiresAt?:number, turnTimeoutSeconds?:number, serverClockOffsetMs=0) => {
  if (!turnExpiresAt || !turnTimeoutSeconds || turnTimeoutSeconds <= 0) return null;
  return Math.min(turnTimeoutSeconds, Math.max(0, Math.ceil((turnExpiresAt - (Date.now() + serverClockOffsetMs)) / 1000)));
};

export const GameHud: React.FC<GameHudProps> = ({ roundNumber, targetTokens, statusLabel, turnExpiresAt, turnTimeoutSeconds, serverClockOffsetMs=0, clockMode='RUNNING', isConnected=true, onOpenSettings }) => {
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
    <RoundInfo>라운드 {roundNumber} <span>· 목표 {targetTokens}</span></RoundInfo><TurnStatus>{statusLabel}</TurnStatus>
    <TurnClock $urgent={clockMode === 'RUNNING' && hasTimeLimit && (secondsLeft ?? 0) <= 10} title={timerLabel} aria-label={timerLabel}>{clockText}</TurnClock>
    <RightGroup title={isConnected ? '실시간 연결됨' : '연결 끊김'}>{isConnected ? <Wifi size={14}/> : <WifiOff size={14}/>}<MenuButton type="button" onClick={onOpenSettings} aria-label="게임 메뉴"><Menu size={17}/></MenuButton></RightGroup>
  </HudContainer>;
};
const HudContainer = styled.header`height:40px; min-height:40px; display:flex; align-items:center; gap:8px; padding:0 9px; box-sizing:border-box; background:rgba(255,255,255,.96); background-image:${THEME.gradients.marbleSlab}; border-bottom:1px solid ${THEME.border}; color:${THEME.foreground}; flex-shrink:0;`;
const RoundInfo = styled.div`font-family:${THEME.font.serif}; font-size:11px; font-weight:900; letter-spacing:.03em; span{color:${THEME.mutedForeground}; font-family:${THEME.font.sans}; font-weight:700;}`;
const TurnStatus = styled.div`min-width:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:${THEME.burgundy}; font-size:11px; font-weight:850;`;
const TurnClock = styled.span<{$urgent:boolean}>`flex:0 0 auto; min-width:31px; padding:3px 5px; border:1px solid ${p => p.$urgent ? THEME.burgundy : THEME.border}; border-radius:6px; color:${p => p.$urgent ? THEME.burgundy : THEME.primary}; background:${p => p.$urgent ? '#fff1f2' : '#fff'}; text-align:center; font-size:10px; font-weight:900; font-variant-numeric:tabular-nums;`;
const RightGroup = styled.div`margin-left:auto;display:flex; align-items:center; gap:8px; color:${THEME.mutedForeground};`;
const MenuButton = styled.button`display:grid; place-items:center; width:27px; height:27px; padding:0; border:1px solid ${THEME.border}; border-radius:7px; color:${THEME.primary}; background:#fff; cursor:pointer;`;
