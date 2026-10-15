import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Maximize, X } from 'lucide-react';
import { THEME } from './theme';

const Control = styled.button`
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-width:44px;min-height:44px;padding:8px;border:1px solid ${THEME.border};
  border-radius:${THEME.radius.md};background:${THEME.surfaceCard};color:${THEME.foreground};
  font:700 14px ${THEME.font.sans};cursor:pointer;
  &:hover:not(:disabled){background:${THEME.secondary};}
  &:focus-visible{outline:2px solid ${THEME.burgundy};outline-offset:2px;}
  &:disabled{opacity:.5;cursor:default;}
  &[aria-pressed=true]{background:${THEME.primary};color:${THEME.primaryForeground};}
`;
const Sheet = styled.dialog`
  box-sizing:border-box;width:min(400px,calc(100vw - 32px));max-height:calc(100dvh - 32px);
  overflow:auto;margin:auto;padding:16px;border:1px solid ${THEME.border};
  border-radius:${THEME.radius.lg};background:${THEME.surfaceCard};color:${THEME.foreground};
  font:14px ${THEME.font.sans};word-break:keep-all;
  &::backdrop{background:rgba(9,13,22,.5);}
  header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
  h2{font:700 20px ${THEME.font.serif};margin:0;}
  .directions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0;}
  p{line-height:1.6;margin:12px 0 0;}
`;

export default function GameScreenControls() {
  const dialog=useRef(null), busyRef=useRef(false), mounted=useRef(false);
  const ownsLock=useRef(false), ownsFullscreen=useRef(false);
  const [mode,setMode]=useState('auto'),[busy,setBusy]=useState(false);
  const [fullscreen,setFullscreen]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    mounted.current=true;
    const sync=()=>{
      setFullscreen(Boolean(document.fullscreenElement));
      if(!document.fullscreenElement){
        if(ownsLock.current)window.screen.orientation?.unlock?.();
        ownsLock.current=false;ownsFullscreen.current=false;setMode('auto');
      }
    };
    sync();document.addEventListener('fullscreenchange',sync);
    return()=>{
      mounted.current=false;document.removeEventListener('fullscreenchange',sync);
      if(ownsLock.current)window.screen.orientation?.unlock?.();
      if(ownsFullscreen.current&&document.fullscreenElement===document.documentElement)document.exitFullscreen().catch(()=>{});
    };
  },[]);
  const change=async(next)=>{
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);setMessage('');
    try{
      if(next==='auto'){
        window.screen.orientation?.unlock?.();ownsLock.current=false;setMode('auto');
      }else if(next==='fullscreen'&&document.fullscreenElement){
        await document.exitFullscreen();
      }else{
        if(!document.fullscreenElement){
          if(!document.documentElement.requestFullscreen)throw new Error('FULLSCREEN_UNAVAILABLE');
          await document.documentElement.requestFullscreen();ownsFullscreen.current=true;
        }
        if(!mounted.current){if(ownsFullscreen.current)await document.exitFullscreen();return;}
        if(next!=='fullscreen'){
          if(!window.screen.orientation?.lock)throw new Error('ORIENTATION_UNAVAILABLE');
          await window.screen.orientation.lock(next);ownsLock.current=true;
          if(!mounted.current){window.screen.orientation.unlock();return;}
          setMode(next);
        }
        setFullscreen(Boolean(document.fullscreenElement));
      }
    }catch{
      if(mounted.current)setMessage(next==='fullscreen'?'이 브라우저에서는 전체화면을 사용할 수 없습니다.':`방향 고정을 지원하지 않습니다. 기기를 ${next==='portrait'?'세로':'가로'}로 돌려 주세요. 화면은 자동으로 맞춰집니다.`);
    }finally{
      busyRef.current=false;if(mounted.current)setBusy(false);
    }
  };
  return <>
    <Control type="button" aria-label="화면 방향 및 전체화면" onClick={()=>dialog.current?.showModal()}><Maximize size={18}/></Control>
    <Sheet ref={dialog} aria-labelledby="game-screen-title">
      <header><h2 id="game-screen-title">화면 보기</h2><Control autoFocus aria-label="화면 설정 닫기" onClick={()=>dialog.current?.close()}><X size={18}/></Control></header>
      <div className="directions" role="group" aria-label="화면 방향">
        {[['auto','자동'],['portrait','세로'],['landscape','가로']].map(([value,label])=><Control key={value} disabled={busy} aria-pressed={mode===value} onClick={()=>change(value)}>{label}</Control>)}
      </div>
      <Control disabled={busy} onClick={()=>change('fullscreen')}>{fullscreen?'전체화면 종료':'전체화면으로 보기'}</Control>
      <p role="status">{busy?'화면을 전환하고 있습니다…':message||'기기를 돌리면 테이블이 화면에 맞춰집니다. 방향 고정은 지원되는 브라우저에서 전체화면으로 적용됩니다.'}</p>
    </Sheet>
  </>;
}
