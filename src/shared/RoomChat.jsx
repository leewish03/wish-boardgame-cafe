import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { MessageCircle, Send, X } from 'lucide-react';
import { THEME } from './theme';
import { Input } from './components';
import { useVisualViewportRect } from './useVisualViewportRect';

const Shell = styled.section`display:flex;flex-direction:column;min-width:0;height:100%;border:1px solid ${THEME.border};border-radius:${THEME.radius.lg};overflow:hidden;background:#fff;box-shadow:${THEME.shadows.marbleSlab};`;
const ChatHeader=styled.header`min-height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 14px;border-bottom:1px solid ${THEME.border};background:#fffdf8;strong{font:900 14px ${THEME.font.serif};color:${THEME.foreground};}`;
const CloseButton=styled.button`width:36px;height:36px;display:grid;place-items:center;border:1px solid ${THEME.border};border-radius:50%;background:#fff;color:${THEME.foreground};cursor:pointer;`;
const Feed = styled.div`flex:1;min-height:0;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:7px;`;
const Line = styled.div`display:flex;gap:6px;font-size:12px;line-height:1.38;word-break:break-word;&[data-system='true']{justify-content:center;color:${THEME.mutedForeground};font-size:11px;font-weight:700;text-align:center;}&[data-self='true'] strong{color:${THEME.primary};}strong{flex:0 0 auto;color:${THEME.burgundy};font-size:11px;}span{min-width:0;}`;
const Form = styled.form`display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;padding:8px;border-top:1px solid ${THEME.border};background:#fff;`;
const SendButton=styled.button`min-width:58px;height:40px;padding:0 11px;display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid ${THEME.goldAntique};border-radius:8px;background:${THEME.gradients.obsidianButton};color:#fff;font:800 11px ${THEME.font.sans};cursor:pointer;`;
const ViewportOverlay=styled.div`position:fixed;z-index:2000;pointer-events:auto;padding:8px;box-sizing:border-box;`;
const ChatPanel=styled.div`height:100%;width:min(560px,100%);margin:0 auto;`;
const Toggle = styled.button`position:fixed;right:14px;bottom:max(14px,env(safe-area-inset-bottom));z-index:901;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:1px solid ${THEME.gold};color:#fff;background:${THEME.primary};box-shadow:0 8px 20px rgba(9,13,22,.25);cursor:pointer;span{position:absolute;right:-3px;top:-3px;min-width:17px;height:17px;padding:0 4px;border-radius:10px;display:grid;place-items:center;background:${THEME.burgundy};font-size:9px;font-weight:900;}`;

export function RoomChat({ messages = [], onSend, mode = 'panel', currentUserId, onOpenChange }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(messages.length);
  const feedRef = useRef(null);
  const launcherRef = useRef(null);
  const compact = mode === 'sheet';
  const viewport = useVisualViewportRect(compact && open);
  const unread = compact && !open ? Math.max(0, messages.length - seen) : 0;
  const close = () => setOpen(false);
  useEffect(() => { onOpenChange?.(open); }, [onOpenChange, open]);
  useEffect(() => () => onOpenChange?.(false), [onOpenChange]);
  useEffect(() => { if (open || !compact) setSeen(messages.length); }, [messages.length, open, compact]);
  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, [messages.length, open]);
  useEffect(() => { if (!open) launcherRef.current?.focus(); }, [open]);
  const submit = (event) => { event.preventDefault(); const value = text.trim(); if (!value) return; onSend?.(value); setText(''); };
  const content = <Shell><ChatHeader><strong>게임 채팅</strong>{compact && <CloseButton type="button" onClick={close} aria-label="채팅 닫기"><X size={19}/></CloseButton>}</ChatHeader><Feed ref={feedRef}>{messages.map((message) => <Line key={message.id} data-system={message.type === 'system'} data-self={Boolean(currentUserId && message.userId === currentUserId)}>{message.type === 'system' ? <span>{message.text}</span> : <><strong>{currentUserId && message.userId === currentUserId ? '나' : message.nickname || '상대'}</strong><span>{message.text}</span></>}</Line>)}</Feed><Form onSubmit={submit}><Input value={text} onChange={(event) => setText(event.target.value)} placeholder="메시지 입력…" maxLength={300} autoFocus={compact && open}/><SendButton type="submit" aria-label="메시지 보내기"><Send size={15}/>전송</SendButton></Form></Shell>;
  if (!compact) return content;
  const panel = open && typeof document !== 'undefined' ? createPortal(<ViewportOverlay style={{top:viewport.top,left:viewport.left,width:viewport.width,height:viewport.height}}><ChatPanel>{content}</ChatPanel></ViewportOverlay>, document.body) : null;
  return <>{panel}<Toggle ref={launcherRef} type="button" onClick={() => setOpen(value => !value)} aria-label="채팅 열기"><MessageCircle size={20}/>{unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}</Toggle></>;
}
