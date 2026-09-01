import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { MessageCircle, Send, X } from 'lucide-react';
import { THEME } from './theme';
import { Button, Input } from './components';

const Shell = styled.section`
  display:flex; flex-direction:column; min-width:0; height:${p => p.$compact ? '100%' : '240px'};
  border:1px solid ${THEME.border}; border-radius:${THEME.radius.lg}; overflow:hidden;
  background:#fff; box-shadow:${THEME.shadows.marbleSlab};
`;
const Feed = styled.div`flex:1; min-height:0; overflow:auto; padding:10px 12px; display:flex; flex-direction:column; gap:7px;`;
const Line = styled.div`
  display:flex; gap:6px; font-size:12px; line-height:1.38; word-break:break-word;
  &[data-system='true']{justify-content:center;color:${THEME.mutedForeground};font-size:11px;font-weight:700;text-align:center;}
  strong{flex:0 0 auto;color:${THEME.burgundy};font-size:11px;} span{min-width:0;}
`;
const Form = styled.form`display:flex; gap:7px; padding:8px; border-top:1px solid ${THEME.border}; background:#fff;`;
const Floating = styled.div`
  position:fixed; right:12px; bottom:max(12px, env(safe-area-inset-bottom)); z-index:900;
  width:min(360px, calc(100vw - 24px)); height:min(340px, 48dvh);
`;
const Toggle = styled.button`
  position:fixed; right:14px; bottom:max(14px, env(safe-area-inset-bottom)); z-index:901;
  width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:1px solid ${THEME.gold};
  color:#fff;background:${THEME.primary};box-shadow:0 8px 20px rgba(9,13,22,.25);cursor:pointer;
  span{position:absolute;right:-3px;top:-3px;min-width:17px;height:17px;padding:0 4px;border-radius:10px;display:grid;place-items:center;background:${THEME.burgundy};font-size:9px;font-weight:900;}
`;

/** @param {{messages?: Array<{id:string, type?:string, nickname?:string, text:string}>, onSend?: (text:string)=>void, mode?: 'panel'|'sheet'}} props */
export function RoomChat({ messages = [], onSend, mode = 'panel' }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(messages.length);
  const feedRef = useRef(null);
  const compact = mode === 'sheet';
  const unread = compact && !open ? Math.max(0, messages.length - seen) : 0;
  useEffect(() => { if (open || !compact) setSeen(messages.length); }, [messages.length, open, compact]);
  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, [messages.length, open]);
  const submit = (event) => { event.preventDefault(); const value = text.trim(); if (!value) return; onSend?.(value); setText(''); };
  const content = <Shell $compact={compact}><Feed ref={feedRef}>{messages.map((message) => <Line key={message.id} data-system={message.type === 'system'}>{message.type === 'system' ? <span>{message.text}</span> : <><strong>{message.nickname || '플레이어'}</strong><span>{message.text}</span></>}</Line>)}</Feed><Form onSubmit={submit}><Input value={text} onChange={(event) => setText(event.target.value)} placeholder="메시지 입력…" maxLength={300}/><Button type="submit" $variant="ghost" $size="icon" aria-label="메시지 보내기"><Send size={16}/></Button></Form></Shell>;
  if (!compact) return content;
  return <>{open && <Floating>{content}</Floating>}<Toggle type="button" onClick={() => setOpen(value => !value)} aria-label={open ? '채팅 닫기' : '채팅 열기'}>{open ? <X size={20}/> : <MessageCircle size={20}/>} {unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}</Toggle></>;
}
