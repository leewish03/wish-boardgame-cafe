import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { LoveLetterGame } from '../src/games/love-letter/ui/LoveLetterGame';
const playerId = new URLSearchParams(location.search).get('player') || 'p0';
const socket = io('http://127.0.0.1:3114', { autoConnect: false });
const room = { code: 'TASK9' };
function Fixture() {
  const [value, setValue] = useState('2');
  const [terminal, setTerminal] = useState('none');
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('준비');
  useEffect(() => {
    const join = () => { setConnected(true); socket.emit('fixture:join', { playerId }); };
    const disconnected = () => setConnected(false);
    socket.on('connect', join); socket.on('disconnect', disconnected); socket.connect();
    return () => { socket.off('connect', join); socket.off('disconnect', disconnected); socket.disconnect(); };
  }, []);
  return <>
    <nav style={{padding:8,background:'#fff',display:'flex',flexWrap:'wrap',gap:8,fontSize:14}} aria-label="격리 QA 시나리오">
      <strong>격리 QA · {playerId} · {connected ? '연결됨' : '연결 끊김'}</strong>
      {playerId === 'p0' && <>
        <select aria-label="시나리오 카드" value={value} onChange={e => setValue(e.target.value)}>{['경비병','사제','남작','시녀','왕자','국왕','백작부인','공주'].map((name,i) => <option key={name} value={i+1}>{name}</option>)}</select>
        <select aria-label="종료 조건" value={terminal} onChange={e => setTerminal(e.target.value)}><option value="none">일반 행동</option><option value="round">라운드 종료</option><option value="match">매치 종료</option></select>
        <button onClick={() => socket.emit('fixture:reset',{value:+value,terminal},(result:{success:boolean;error?:string}) => setStatus(result.success ? '시나리오 준비됨' : result.error || '오류'))}>시나리오 시작</button>
      </>}
      <button onClick={() => connected ? socket.disconnect() : socket.connect()}>{connected ? '연결 끊기' : '재연결'}</button>
      <button onClick={() => socket.emit('fixture:replay-ack', {}, (result:{success:boolean;error?:string}) => setStatus(result.success ? '이전 완료 확인 수락' : result.error || '이전 완료 확인 거부'))}>이전 완료 확인 재전송</button>
      <output>{status}</output>
    </nav>
    <LoveLetterGame socket={socket} roomState={room} currentUser={{id:playerId,nickname:playerId}} onLeave={() => setStatus('나가기 요청됨')}/>
  </>;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Fixture/>);
