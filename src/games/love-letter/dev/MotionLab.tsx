/// <reference types="vite/client" />
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { LoveLetterGame } from '../ui/LoveLetterGame';
const playerId = new window.URLSearchParams(window.location.search).get('player') || 'p0';
const socket = io('http://127.0.0.1:3002', { autoConnect: false });
const room = { code: 'MOTION' };
function Lab() {
  const [value, setValue] = useState('2');
  const [count, setCount] = useState('4');
  useEffect(() => {
    const join = () => socket.emit('lab:join', { playerId });
    socket.on('connect', join); socket.connect();
    return () => { socket.off('connect', join); socket.disconnect(); };
  }, []);
  return <><nav style={{ padding: 6, background: '#eee', display: 'flex', gap: 8 }}>
    <label>카드 <select aria-label="시나리오 카드" value={value} onChange={e => setValue(e.target.value)}>{['경비병','사제','남작','시녀','왕자','국왕','백작부인','공주'].map((n, i) => <option key={n} value={i+1}>{i+1} {n}</option>)}</select></label>
    <select aria-label="인원" value={count} onChange={e => setCount(e.target.value)}>{[2,4,6].map(n => <option key={n}>{n}</option>)}</select>
    <button onClick={() => socket.emit('lab:reset', { value: +value, count: +count })}>시나리오 시작</button>
    <span>{playerId}</span>
  </nav><LoveLetterGame socket={socket} roomState={room} currentUser={{ id: playerId, nickname: playerId }}/></>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Lab/>);
