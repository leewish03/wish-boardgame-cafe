import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { MessageCircle, Send, X } from 'lucide-react';
import { THEME } from './theme';
import { Input } from './components';
import { useVisualViewportRect } from './useVisualViewportRect';
import { useDialogFocus } from './useDialogFocus';

const Shell = styled.section`display:flex;flex-direction:column;min-width:0;height:100%;border:1px solid ${THEME.border};border-radius:${THEME.radius.lg};overflow:hidden;background:#fff;box-shadow:${THEME.shadows.marbleSlab};`;
const ChatHeader=styled.header`min-height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 14px;border-bottom:1px solid ${THEME.border};background:#fffdf8;strong{font:900 14px ${THEME.font.serif};color:${THEME.foreground};}`;
const CloseButton=styled.button`width:44px;height:44px;display:grid;place-items:center;border:1px solid ${THEME.border};border-radius:50%;background:#fff;color:${THEME.foreground};cursor:pointer;`;
const Feed = styled.div`flex:1;min-height:0;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:7px;overflow-anchor:none;`;
const Line = styled.div`display:flex;gap:6px;font-size:12px;line-height:1.38;word-break:break-word;&[data-system='true']{justify-content:center;color:${THEME.mutedForeground};font-size:11px;font-weight:700;text-align:center;}&[data-self='true'] strong{color:${THEME.primary};}strong{flex:0 0 auto;color:${THEME.burgundy};font-size:11px;}span{min-width:0;}`;
const Form = styled.form`display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;padding:8px;border-top:1px solid ${THEME.border};background:#fff;`;
const SendButton=styled.button`min-width:58px;height:44px;padding:0 11px;display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid ${THEME.goldAntique};border-radius:8px;background:${THEME.gradients.obsidianButton};color:#fff;font:800 11px ${THEME.font.sans};cursor:pointer;&:disabled{opacity:.55;cursor:wait;}`;
const ViewportOverlay=styled.div`position:fixed;z-index:2000;pointer-events:auto;padding:8px;box-sizing:border-box;`;
const ChatPanel=styled.div`height:100%;width:min(560px,100%);margin:0 auto;`;
const Toggle = styled.button`position:${p=>p.$inline?'relative':'fixed'};right:${p=>p.$inline?'auto':'14px'};bottom:${p=>p.$inline?'auto':'max(14px,env(safe-area-inset-bottom))'};z-index:901;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:1px solid ${THEME.gold};color:#fff;background:${THEME.primary};box-shadow:0 5px 12px rgba(9,13,22,.2);cursor:pointer;span{position:absolute;right:-3px;top:-3px;min-width:17px;height:17px;padding:0 4px;border-radius:10px;display:grid;place-items:center;background:${THEME.burgundy};font-size:9px;font-weight:900;}`;

const NewMessages=styled.button`flex-shrink:0;min-height:${THEME.interaction.touchTarget};padding:${THEME.interaction.gap};border:0;border-top:1px solid ${THEME.border};background:${THEME.surfaceCard};color:${THEME.burgundy};font:700 ${THEME.interaction.body} ${THEME.font.sans};cursor:pointer;`;

export function RoomChat({ messages = [], onSend, mode = 'panel', currentUserId, onOpenChange, launcherPlacement = 'fixed' }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const sendingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const receivedIds = useRef(new Set(messages.map(message => message.id)));
  const reading = useRef({ atBottom: true, anchorId: null, offset: 0 });
  const feedRef = useRef(null);
  const launcherRef = useRef(null);
  const compact = mode === 'sheet';
  const viewport = useVisualViewportRect(compact && open);
  const close = () => setOpen(false);
  const dialogRef = useDialogFocus(compact && open, close);
  useEffect(() => { onOpenChange?.(open); }, [onOpenChange, open]);
  useEffect(() => () => onOpenChange?.(false), [onOpenChange]);
  const rememberPosition = () => {
    const feed = feedRef.current;
    if (!feed) return;
    const top = feed.getBoundingClientRect().top;
    const anchor = Array.from(feed.children).find(line => line.getBoundingClientRect().bottom > top);
    reading.current = {
      atBottom: feed.scrollHeight - feed.scrollTop - feed.clientHeight <= 24,
      anchorId: anchor?.dataset.messageId,
      offset: anchor ? anchor.getBoundingClientRect().top - top : 0,
    };
    if (reading.current.atBottom) setUnread(0);
  };
  const showLatest = () => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    reading.current.atBottom = true;
    setUnread(0);
  };
  useLayoutEffect(() => {
    let arrivals = 0;
    for (const message of messages) {
      if (!receivedIds.current.has(message.id)) arrivals++;
      receivedIds.current.add(message.id);
    }
    const feed = feedRef.current;
    if ((!compact || open) && feed) {
      if (reading.current.atBottom) {
        showLatest();
        return;
      }
      const anchor = Array.from(feed.children).find(line => line.dataset.messageId === reading.current.anchorId);
      if (anchor) feed.scrollTop += anchor.getBoundingClientRect().top - feed.getBoundingClientRect().top - reading.current.offset;
    }
    if (arrivals) setUnread(count => count + arrivals);
  }, [messages, open, compact, viewport.width, viewport.height]);
  const submit = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !onSend || sendingRef.current) return;
    sendingRef.current = true; setSending(true); setSendError('');
    try {
      if (await onSend(value) === false) setSendError('메시지를 보내지 못했습니다. 다시 시도해 주세요.');
      else setText(current => current.trim() === value ? '' : current);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : '메시지를 보내지 못했습니다. 다시 시도해 주세요.');
    } finally {
      sendingRef.current = false; setSending(false);
    }
  };
  const content = <Shell><ChatHeader><strong>게임 채팅</strong>{compact && <CloseButton type="button" onClick={close} aria-label="채팅 닫기"><X size={19}/></CloseButton>}</ChatHeader><Feed ref={feedRef} onScroll={rememberPosition} aria-label="채팅 메시지">{messages.map((message) => <Line key={message.id} data-message-id={message.id} data-system={message.type === 'system'} data-self={Boolean(currentUserId && message.userId === currentUserId)}>{message.type === 'system' ? <span>{message.text}</span> : <><strong>{currentUserId && message.userId === currentUserId ? '나' : message.nickname || '상대'}</strong><span>{message.text}</span></>}</Line>)}</Feed>{unread > 0 && <NewMessages type="button" onClick={showLatest}>새 메시지 {unread}개 · 최신으로</NewMessages>}{sendError && <p role="alert" style={{margin:'8px 12px',color:THEME.destructive,fontSize:13}}>{sendError}</p>}<Form onSubmit={submit} autoComplete="off"><Input type="text" name="game-chat-message" value={text} onChange={(event) => setText(event.target.value)} placeholder="메시지 입력…" maxLength={300} autoComplete="off" inputMode="text" enterKeyHint="send" autoCapitalize="sentences" autoCorrect="on" spellCheck data-1p-ignore data-lpignore="true" data-bwignore="true"/><SendButton type="submit" disabled={sending} aria-label="메시지 보내기"><Send size={15}/>{sending ? '전송 중' : '전송'}</SendButton></Form></Shell>;
  if (!compact) return content;
  const panel = open && typeof document !== 'undefined' ? createPortal(<ViewportOverlay style={{top:viewport.top,left:viewport.left,width:viewport.width,height:viewport.height}}><ChatPanel ref={dialogRef} role="dialog" aria-modal="true" aria-label="게임 채팅" tabIndex={-1}>{content}</ChatPanel></ViewportOverlay>, document.body) : null;
  const inline = launcherPlacement === 'inline';
  return <>{panel}<Toggle $inline={inline} ref={launcherRef} type="button" onClick={() => setOpen(value => !value)} aria-label={unread ? `채팅 열기, 읽지 않은 메시지 ${unread}개` : '채팅 열기'} aria-expanded={open}><MessageCircle size={inline ? 19 : 20}/>{unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}</Toggle></>;
}
