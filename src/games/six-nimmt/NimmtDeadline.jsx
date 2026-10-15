import React, { useEffect, useMemo, useState } from 'react';
import { THEME } from '../../shared/theme';

export function deadlineText(room, serverNow, connected) {
  if(room.game?.matchState!=='PLAYING')return null;
  if(room.isPaused)return '제한시간 일시정지 · 재접속을 기다립니다';
  if(!connected)return '재접속 중 · 제한시간을 동기화합니다';
  if(!room.turnTimeLimit)return '제한시간 없음';
  if(room.presentation?.pending||room.game.playPhase==='RESOLVING')return '카드 이동 중 · 제한시간 대기';
  const row=room.game.playPhase==='CHOOSING_ROW';
  if(!Number.isFinite(serverNow)||!Number.isFinite(room.turnExpiresAt)||room.turnExpiresAt<=0)return '서버 제한시간을 동기화합니다';
  const seconds=Math.max(0,Math.ceil((room.turnExpiresAt-serverNow)/1000));
  const consequence=row?'서버가 줄을 자동 선택합니다':'서버가 카드를 자동 선택합니다';
  if(!seconds)return `시간 종료 · ${consequence}`;
  return `${row?'줄':'카드'} 선택 ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} · 시간 종료 시 ${consequence}`;
}

export default function NimmtDeadline({ room, connected }) {
  const anchor=useMemo(()=>({server:room.serverTime,local:window.performance.now()}),[room.serverTime,room.turnExpiresAt]);
  const [now,setNow]=useState(()=>window.performance.now());
  useEffect(()=>{
    setNow(window.performance.now());
    if(room.game?.matchState!=='PLAYING'||room.game?.playPhase==='RESOLVING'||room.isPaused||!connected||!room.turnTimeLimit||room.presentation?.pending)return;
    const timer=setInterval(()=>setNow(window.performance.now()),250);
    return()=>clearInterval(timer);
  },[room.game?.matchState,room.game?.playPhase,room.isPaused,connected,room.turnTimeLimit,room.turnExpiresAt,room.serverTime,room.presentation?.pending]);
  const text=deadlineText(room,Number.isFinite(anchor.server)?anchor.server+Math.max(0,now-anchor.local):NaN,connected);
  return text?<small aria-label="제한시간" aria-live="off" style={{display:'block',fontSize:THEME.interaction.caption,fontWeight:400,fontVariantNumeric:'tabular-nums'}}>{text}</small>:null;
}
