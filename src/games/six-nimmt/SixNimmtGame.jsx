import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Check, HelpCircle, LogOut, Menu, X } from 'lucide-react';
import { THEME } from '../../shared/theme';
import { Button } from '../../shared/components';
import { RoomChat } from '../../shared/RoomChat';
import GameScreenControls from '../../shared/GameScreenControls';
import { RoomVoiceControls } from '../love-letter/ui/GameMenuDrawer';
import { bullheads, rowPoints } from '../../../packages/six-nimmt-core/src/cards.js';

const Shell = styled.main`width:100%;min-width:0;box-sizing:border-box;height:100dvh;overflow:auto;background:${THEME.gradients.marbleBase};color:${THEME.foreground};font:14px ${THEME.font.sans};word-break:keep-all;--card-w:68px;--card-h:94px;button:focus-visible{outline:3px solid ${THEME.gold};outline-offset:3px;}@media(max-width:600px),(max-height:900px){--card-w:52px;--card-h:76px;}@media(max-width:600px){--card-h:68px;}@media(max-width:360px){--card-w:44px;--card-h:52px;}@media(max-height:900px){>header{padding:8px 12px;}section{padding-top:4px;padding-bottom:4px;}}@media(min-width:700px) and (max-height:500px) and (orientation:landscape){--card-h:52px;display:grid;grid-template-columns:minmax(0,1fr) 240px;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;>header,>div[role=status],>p{grid-column:1/-1;} >section{grid-row:3;} >section[aria-label="내 손패와 선택"]{position:static;min-height:0;overflow:auto;grid-column:2;>div:first-child{flex-wrap:wrap;justify-content:center;} >div:last-child{flex-wrap:wrap;}}}`;
const Header = styled.header`display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;border-bottom:1px solid ${THEME.border};background:${THEME.surfaceCardGlass};h1{font:700 24px ${THEME.font.display};margin:0;}small{color:${THEME.mutedForeground};}nav{display:flex;gap:8px;}@media(max-width:360px){padding:8px;gap:8px;h1{font-size:20px;}nav{gap:4px;}}`;
const IconButton = styled.button`display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:44px;min-height:44px;background:${THEME.surfaceCard};color:${THEME.foreground};border:1px solid ${THEME.border};border-radius:${THEME.radius.md};cursor:pointer;&:hover:not(:disabled){background:${THEME.secondary};}&:active:not(:disabled){box-shadow:inset 0 0 0 2px ${THEME.goldAntique};}`;
const Table = styled.section`max-width:1000px;margin:0 auto;padding:12px;@media(min-width:700px) and (max-height:500px) and (orientation:landscape){min-width:0;min-height:0;max-width:none;width:100%;box-sizing:border-box;overflow:auto;display:grid;grid-template-columns:100px minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr);gap:8px;>[aria-label="참가자와 벌점"]{grid-column:1;grid-row:1;flex-direction:column;overflow:auto;padding:0;>div{flex:0 0 auto;padding:8px;}}>[aria-label="작은 숫자부터 공개 카드 해결"]{grid-column:1;grid-row:2;min-height:0;overflow:auto;flex-direction:column;justify-content:flex-start;} >[aria-label="네 개의 카드 줄"]{grid-column:2;grid-row:1/3;min-height:0;overflow:auto;margin:0;} >section{grid-column:1/-1;}}${p=>p.$results?'grid-column:1/-1;display:block;overflow:auto;width:100%;box-sizing:border-box;':''}`;
const Seats = styled.div`display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;padding:4px 0 12px;`;
const Seat = styled.div`flex:1 0 112px;min-width:0;position:relative;padding:8px 12px;border-radius:${THEME.radius.md};background:${p=>p.$active?THEME.primary:THEME.surfaceCard};color:${p=>p.$active?THEME.primaryForeground:THEME.foreground};strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}small{display:block;margin-top:4px;}span{font-variant-numeric:tabular-nums;}`;
const Pile = styled.div`position:absolute;right:8px;bottom:8px;width:16px;height:22px;pointer-events:none;>div{position:absolute;right:0;bottom:0;transform-origin:bottom right;}`;
const Status = styled.div`min-height:44px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-align:center;gap:8px;padding:4px;font-weight:700;`;
const Queue = styled.div`display:flex;gap:12px;box-sizing:border-box;min-height:calc(var(--card-h) + 24px);overflow-x:auto;align-items:center;justify-content:safe center;padding:4px;`;
const QueueItem = styled.div`flex:none;text-align:center;small{display:block;max-width:var(--card-w);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:4px;font-size:12px;}`;
const Rows = styled.div`width:max-content;max-width:100%;margin-inline:auto;box-sizing:border-box;overflow-x:auto;padding:8px 0;background:${THEME.surfaceCardGlass};border-radius:${THEME.radius.lg};box-shadow:${THEME.shadows.marbleSlab};`;
const Row = styled.div`min-width:340px;display:flex;align-items:center;gap:8px;padding:6px 12px;background:${p=>p.$selected?THEME.secondary:p.$choose?THEME.backgroundSecondary:'transparent'};box-shadow:${p=>p.$selected?`inset 0 0 0 2px ${THEME.burgundy}`:'none'};cursor:${p=>p.$choose?'pointer':'default'};&:focus-visible{outline:3px solid ${THEME.gold};outline-offset:-3px;}@media(max-width:600px){gap:4px;padding:4px 8px;}@media(max-width:360px){min-width:0;gap:3px;padding:4px;}`;
const RowLabel = styled.div`width:52px;flex:none;text-align:center;font-size:12px;strong{display:block;font:700 22px ${THEME.font.display};}button{width:100%;min-height:60px;border:0;border-radius:6px;background:${THEME.primary};color:${THEME.primaryForeground};cursor:pointer;&:hover:not(:disabled){background:${THEME.burgundy};}&:active:not(:disabled){box-shadow:inset 0 0 0 2px ${THEME.goldAntique};}&:disabled{opacity:.48;cursor:default;}}@media(max-width:600px){width:44px;}@media(max-width:360px){width:32px;}`;
const Slot = styled.div`width:var(--card-w);height:var(--card-h);flex:none;border-radius:${THEME.radius.md};background:${THEME.background};box-shadow:inset 0 0 0 1px ${THEME.border};display:grid;place-items:center;color:${THEME.mutedForeground};font:18px ${THEME.font.display};`;
const Sixth = styled(Slot)`@media(max-width:600px){display:none;}`;
const CardFace = styled(motion.div)`width:var(--card-w);height:var(--card-h);flex:none;box-sizing:border-box;position:relative;border-radius:${THEME.radius.md};background:${p=>p.$back?THEME.burgundy:THEME.surfaceCard};color:${p=>p.$back?THEME.primaryForeground:THEME.foreground};box-shadow:${THEME.shadows.marbleSlab};border:1px solid ${THEME.border};display:flex;flex-direction:column;align-items:center;justify-content:center;strong{font:700 36px ${THEME.font.display};line-height:1;}small{display:flex;align-items:center;gap:4px;font:700 12px ${THEME.font.sans};color:${p=>p.$back?THEME.goldLight:THEME.burgundy};}svg{width:18px;height:18px;}@media(max-width:600px){strong{font-size:30px;}}@media(max-width:360px){strong{font-size:26px;}small{font-size:11px;}svg{width:14px;height:14px;}}@media(min-width:700px) and (max-height:500px) and (orientation:landscape){strong{font-size:28px;}small{font-size:11px;}svg{width:14px;height:14px;}}`;
const Hand = styled.div`display:flex;gap:8px;overflow-x:auto;padding:12px 4px 8px;justify-content:safe center;`;
const HandButton = styled.button`flex:none;padding:0;border:0;background:transparent;border-radius:6px;cursor:pointer;position:relative;opacity:${p=>p.disabled?0.62:1};>svg{position:absolute;right:2px;top:2px;z-index:2;background:${THEME.primary};color:white;border-radius:50%;}&[aria-pressed=true]{outline:3px solid ${THEME.burgundy};outline-offset:2px;}&:hover:not(:disabled){outline:2px solid ${THEME.goldAntique};outline-offset:2px;}&:active:not(:disabled){filter:brightness(.9);} &:disabled{cursor:default;}`;
const Tray = styled.section`position:sticky;bottom:0;z-index:5;background:${THEME.surfaceCardGlass};padding:8px 12px max(12px,env(safe-area-inset-bottom));border-top:1px solid ${THEME.border};text-align:center;button{min-height:44px;} >div:last-child{display:flex;justify-content:center;align-items:center;gap:12px;min-height:44px;}p{margin:4px;}@media(min-width:700px) and (max-height:500px) and (orientation:landscape){display:flex;flex-direction:column;>div:first-child{min-height:0;overflow:auto;flex:1;} >div:last-child{flex-shrink:0;background:${THEME.surfaceCard};}}`;
const ErrorText = styled.p`color:${THEME.destructive};background:${THEME.surfaceCard};padding:12px;text-align:center;`;
const Sheet = styled.dialog`margin:auto;border:1px solid ${THEME.border};border-radius:${THEME.radius.xl};padding:24px;width:min(480px,calc(100% - 32px));max-height:85dvh;overflow:auto;box-sizing:border-box;background:${THEME.surfaceCard};color:${THEME.foreground};box-shadow:${THEME.shadows.marbleSlab};&::backdrop{background:rgba(9,13,22,.5);}header{display:flex;justify-content:space-between;align-items:center;gap:12px;}h2{font:700 28px ${THEME.font.display};margin:0;}p,li{line-height:1.7;}img{width:100%;height:140px;object-fit:cover;border-radius:6px;}button{min-height:44px;}footer{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;}`;
const Results = styled.section`max-width:600px;margin:20px auto;padding:20px;background:${THEME.surfaceCard};border-radius:${THEME.radius.lg};h2{font:700 28px ${THEME.font.display};}ol{padding-left:24px;}li{padding:8px;}button{min-height:44px;}footer{display:flex;gap:8px;flex-wrap:wrap;}`;

function Bull() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9C3 9 2 4 3 2c2 4 4 4 6 4h6c2 0 4 0 6-4 1 2 0 7-4 7l-1 9-4 4-4-4Z" fill="currentColor"/><path d="m8 11 2 1m6-1-2 1" stroke="white" strokeWidth="1.5"/></svg>; }
function Card({ card, back=false, reduce=false, onComplete }) {
  return <CardFace layoutId={card ? `card-${card}` : undefined} layout $back={back} transition={{layout:{duration:reduce?0.01:0.38,ease:'easeInOut'}}} onLayoutAnimationComplete={onComplete} aria-label={back?'선택 완료 · 뒷면':`${card}, 소머리 ${bullheads(card)}개`}><strong style={{fontFamily:THEME.font.mono,fontVariantNumeric:'tabular-nums',fontSize:card>=100?'24px':undefined}}>{back?'6':card}</strong><small><Bull/>{back?null:`× ${bullheads(card)}`}</small></CardFace>;
}

function Surface({ game, secret, presentation, myId, reduce, onComplete, onChooseRow, selectedRow, locked, focusPlayerId }) {
  const seatsRef=useRef(null), actorSeatRef=useRef(null);
  useLayoutEffect(()=>{
    const seats=seatsRef.current, actor=actorSeatRef.current;
    if(!seats||!actor)return;
    const revealActor=()=>{
      const bounds=seats.getBoundingClientRect(), target=actor.getBoundingClientRect();
      const right=bounds.left+seats.clientWidth, bottom=bounds.top+seats.clientHeight;
      const left=target.left<bounds.left?target.left-bounds.left:Math.max(0,target.right-right);
      const top=target.top<bounds.top?target.top-bounds.top:Math.max(0,target.bottom-bottom);
      seats.scrollBy({left,top,behavior:'instant'});
    };
    revealActor();
    const resize=new window.ResizeObserver(revealActor);
    resize.observe(seats);
    return()=>resize.disconnect();
  },[focusPlayerId]);
  const [arrived,setArrived] = useState(!presentation.pending);
  const [finished,setFinished] = useState(!presentation.pending);
  const doneRef = useRef(false);
  const event = presentation.events?.find(e=>e.type==='ROW_TAKEN'||e.type==='CARD_PLACED');
  const complete = useCallback(()=>{if(doneRef.current)return;doneRef.current=true;setFinished(true);onComplete(presentation.id);},[onComplete,presentation.id]);
  useEffect(()=>{
    if(!presentation.pending)return;
    let second;
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>setArrived(true));});
    // Recovery for remounts or interrupted shared-layout transitions; server also expires its gate.
    const fallback=setTimeout(complete,reduce?180:1800);
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);clearTimeout(fallback);};
  },[presentation.pending,reduce,complete]);
  const rows=game.rows.map(row=>[...row]);
  let queue=game.queue;
  if(event&&!arrived){rows[event.rowIndex]=event.type==='ROW_TAKEN'?event.cards:rows[event.rowIndex].filter(card=>card!==event.card);queue=[{card:event.card,playerId:event.playerId},...queue.filter(item=>item.card!==event.card)];}
  const name=id=>game.players.find(p=>p.id===id)?.nickname||'플레이어';
  return <>
    <Seats ref={seatsRef} aria-label="참가자와 벌점">{game.players.map(player=><Seat ref={player.id===focusPlayerId?actorSeatRef:undefined} key={player.id} $active={game.pendingRowPlayerId===player.id||(!finished&&event?.playerId===player.id)}>
      <strong>{player.nickname}{player.id===myId?' · 나':''}</strong><small><span>{player.score-(event?.type==='ROW_TAKEN'&&event.playerId===player.id&&!finished?event.points:0)}</span> 벌점 <span title="이번 라운드 벌점">(+{player.roundScore-(event?.type==='ROW_TAKEN'&&event.playerId===player.id&&!finished?event.points:0)})</span></small><small>{player.isDisconnected?'재접속 중':player.selected?'✓ 선택 완료':`${player.handCount}장 남음`}{player.isBot?' · AI':''}</small>
      {event?.type==='ROW_TAKEN'&&event.playerId===player.id&&arrived&&<Pile aria-label={`${event.points} 벌점 받음`}>{event.cards.map(card=><div key={card} style={{scale:0.24}}><Card card={card} reduce={reduce}/></div>)}</Pile>}
    </Seat>)}</Seats>
    <Queue aria-label="작은 숫자부터 공개 카드 해결">
      {queue.length?queue.map(item=><QueueItem key={item.card}><motion.div initial={presentation.events?.some(e=>e.type==='CARDS_REVEALED')?{rotateY:reduce?0:90,opacity:0}:false} animate={{rotateY:0,opacity:1}} transition={{duration:reduce?0.01:0.38}}><Card card={item.card} reduce={reduce}/></motion.div><small>{name(item.playerId)}</small></QueueItem>):game.players.filter(p=>p.selected).map(p=><QueueItem key={p.id}><Card card={p.id===myId?secret.selectedCard:null} back reduce={reduce}/><small>{p.nickname}</small></QueueItem>)}
      {!queue.length&&!game.players.some(p=>p.selected)&&<span>{game.matchState==='GAME_OVER'?'게임 종료':game.matchState==='ROUND_END'?'라운드 종료':'모두 한 장씩 선택합니다'}</span>}
    </Queue>
    <Rows aria-label="네 개의 카드 줄">{rows.map((row,index)=><Row key={index} $choose={game.pendingRowPlayerId===myId} $selected={selectedRow===index} role={game.pendingRowPlayerId===myId?'button':undefined} tabIndex={game.pendingRowPlayerId===myId&&!locked?0:undefined} aria-disabled={game.pendingRowPlayerId===myId?locked:undefined} aria-pressed={game.pendingRowPlayerId===myId?selectedRow===index:undefined} aria-label={game.pendingRowPlayerId===myId?`${index+1}번 줄 선택, ${rowPoints(row)} 벌점`:undefined} onClick={()=>{if(game.pendingRowPlayerId===myId&&!locked)onChooseRow(index);}} onKeyDown={e=>{if(game.pendingRowPlayerId===myId&&!locked&&['Enter',' '].includes(e.key)){e.preventDefault();onChooseRow(index);}}}>
      <RowLabel><strong>{index+1}</strong>{rowPoints(row)} 벌점{row.length===5&&<small style={{display:'block',color:THEME.burgundy}}>다음은 수거</small>}</RowLabel>
      {Array.from({length:5},(_,slot)=><Slot key={slot}>{row[slot]?<Card card={row[slot]} reduce={reduce} onComplete={arrived&&event?.card===row[slot]?complete:undefined}/>:<span aria-hidden="true">{slot+1}</span>}</Slot>)}
      <Sixth aria-label="여섯 번째 카드를 놓으면 줄을 가져갑니다"><span>6 →</span></Sixth>
    </Row>)}</Rows>
    {presentation.pending&&!event&&<motion.div key={presentation.id} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:reduce?0.01:0.38}} onAnimationComplete={complete}><Status>{presentation.events?.some(e=>e.type==='CARDS_REVEALED')?'모두 공개 · 작은 숫자부터 놓습니다':presentation.events?.some(e=>e.type==='ROUND_STARTED')?'새 카드가 테이블에 도착했습니다':'테이블을 정리하고 있습니다'}</Status></motion.div>}
  </>;
}

export default function SixNimmtGame({roomState,currentUser,socket,webrtc,stt,chatMessages=[],onSendChat,onLeave,onRoomUnavailable}) {
  const game=roomState.game, secret=roomState.mySecret||{hand:[],legalActions:[]};
  const myId=currentUser?.id, reduce=useReducedMotion(), sheet=useRef(null), pendingRef=useRef(false);
  const [selected,setSelected]=useState(null), [busy,setBusy]=useState(false), [error,setError]=useState(''), [panel,setPanel]=useState(null);
  const [selectedRow,setSelectedRow]=useState(null);
  const presentation=roomState.presentation||{id:null,events:[],pending:false};
  const lastActor=useRef(myId);
  const eventActor=presentation.events?.find(event=>event.type==='ROW_TAKEN'||event.type==='CARD_PLACED')?.playerId;
  useEffect(()=>{if(eventActor)lastActor.current=eventActor;},[eventActor]);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const request=useCallback((event,payload,lock=true)=>{
    if(lock&&pendingRef.current)return;
    if(!socket?.connected){setError('연결이 끊겼습니다. 재접속 후 다시 시도해 주세요.');return;}
    if(lock){pendingRef.current=true;setBusy(true);}setError('');
    const finish=(timeout,result)=>{if(!mounted.current)return;if(lock){pendingRef.current=false;setBusy(false);}if(timeout||result?.success===false||result?.error)setError(result?.error||'응답을 받지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');};
    socket.timeout(7000).emit(event,{roomCode:roomState.code,userId:myId,...payload},finish);
  },[socket,roomState.code,myId]);
  useEffect(()=>{request('board:view-ready',{},false);},[request]);
  useEffect(()=>{const unavailable=data=>onRoomUnavailable?.(data);socket?.on('room:unavailable',unavailable);return()=>socket?.off('room:unavailable',unavailable);},[socket,onRoomUnavailable]);
  useEffect(()=>{setSelected(null);},[game?.selectionVersion]);
  useEffect(()=>{setSelectedRow(null);},[game?.stateVersion]);
  useEffect(()=>{if(panel&&!sheet.current?.open)sheet.current?.showModal();else if(!panel&&sheet.current?.open)sheet.current.close();},[panel]);
  const ack=useCallback(id=>{if(id)request('board:presentation-ack',{eventId:id},false);},[request]);
  if(!game)return <Shell><Status>테이블에 연결하고 있습니다…</Status>{error&&<ErrorText role="alert">{error}</ErrorText>}</Shell>;
  const locked=busy||roomState.isPaused||presentation.pending||!socket?.connected;
  const legal=secret.legalActions||[];
  const canSelect=legal.some(action=>action.type==='SELECT_CARD');
  const send=command=>request('board:command',{expectedVersion:game.stateVersion,command});
  const actor=game.players.find(p=>p.id===game.pendingRowPlayerId);
  const result=game.matchState==='ROUND_END'||game.matchState==='GAME_OVER';
  const leave=()=>game.matchState==='GAME_OVER'?onLeave?.({immediate:true}):setPanel('leave');
  const status=roomState.isPaused?'재접속을 기다립니다 · 게임 일시정지':!socket?.connected?'서버에 다시 연결하고 있습니다':game.playPhase==='CHOOSING_ROW'?`${actor?.nickname||'플레이어'} · 가져올 줄을 선택하세요`:game.playPhase==='RESOLVING'?'작은 숫자부터 차례대로 놓습니다':secret.selectedCard?'선택 완료 · 다른 플레이어를 기다립니다':result?'벌점이 가장 적은 사람이 앞섭니다':'내 카드 한 장을 고르고 확정하세요';
  return <Shell data-testid="six-nimmt-game"><Header><div><h1>6 nimmt!</h1><small>{game.roundNumber} 라운드 · {game.turnNumber}/10 턴 · {game.players.length}인 · 1~{game.config.deckSize ?? 104}번</small></div><nav><GameScreenControls/><IconButton aria-label="게임 규칙" onClick={()=>setPanel('help')}><HelpCircle size={20}/></IconButton><IconButton aria-label="게임 메뉴" onClick={()=>setPanel('menu')}><Menu size={20}/></IconButton><RoomChat messages={chatMessages} onSend={onSendChat} mode="sheet" currentUserId={myId} launcherPlacement="inline"/></nav></Header>
    <Status role="status" aria-live="polite">{status}</Status>{error&&<ErrorText role="alert">{error}</ErrorText>}
    <LayoutGroup id={`nimmt-${roomState.code}`}><Table $results={result&&!presentation.pending}>{!(result&&!presentation.pending)&&<Surface key={presentation.id||`settled-${game.stateVersion}`} game={game} secret={secret} presentation={presentation} myId={myId} reduce={reduce} onComplete={ack} onChooseRow={rowIndex=>setSelectedRow(selectedRow===rowIndex?null:rowIndex)} selectedRow={selectedRow} locked={locked} focusPlayerId={game.pendingRowPlayerId||eventActor||lastActor.current}/>}
      {result&&!presentation.pending&&<Results><h2>{game.matchState==='GAME_OVER'?'최종 결과':'라운드 결과'}</h2>{game.outcome&&<p>{game.players.filter(p=>game.outcome.winnerIds.includes(p.id)).map(p=>p.nickname).join(', ')} 승리</p>}<ol>{[...game.players].sort((a,b)=>a.score-b.score).map(p=><li key={p.id}>{p.nickname} — {p.score} 벌점 <small>(이번 판 +{p.roundScore})</small></li>)}</ol><footer>{roomState.hostId===myId?<Button disabled={locked} onClick={()=>game.matchState==='GAME_OVER'?request('board:start',{}):send({type:'ADVANCE_ROUND'})}>{game.matchState==='GAME_OVER'?'다시 플레이':'다음 라운드'}</Button>:<p>방장이 다음 게임을 시작할 때까지 기다립니다.</p>}<Button onClick={leave}>로비로 나가기</Button></footer></Results>}
    </Table>{!(result&&!presentation.pending)&&<Tray aria-label="내 손패와 선택"><Hand>{secret.hand.map(card=><HandButton key={card} disabled={locked||!legal.some(a=>a.type==='SELECT_CARD'&&a.card===card)} aria-pressed={selected===card} aria-label={`${card} 선택, 소머리 ${bullheads(card)}개`} onClick={()=>setSelected(selected===card?null:card)}>{selected===card&&<Check size={18}/>}<motion.div animate={{y:selected===card&&!reduce?-8:0}} transition={{duration:0.15}}><Card card={card} reduce={reduce}/></motion.div></HandButton>)}</Hand><div>{game.pendingRowPlayerId===myId?<><span>{selectedRow==null?'가져올 줄을 선택하세요':`${selectedRow+1}번 줄 · ${rowPoints(game.rows[selectedRow])} 벌점`}</span><Button disabled={locked||selectedRow==null} onClick={()=>send({type:'CHOOSE_ROW',rowIndex:selectedRow})}>줄 가져오기 확정</Button></>:canSelect?<><span>{selected?`${selected} · ${bullheads(selected)} 벌점`:'한 장 선택'}</span><Button disabled={locked||!selected} onClick={()=>send({type:'SELECT_CARD',card:selected})}>{busy?'전송 중…':selected?`${selected}번 선택 확정`:'선택 확정'}</Button></>:<span>{secret.selectedCard?`${secret.selectedCard} 선택 완료`:result?'라운드가 끝났습니다':'공개된 카드의 이동을 확인하세요'}</span>}</div></Tray>}</LayoutGroup>
    <Sheet ref={sheet} onCancel={()=>setPanel(null)} onClose={()=>setPanel(null)} aria-label={panel==='help'?'식스 님트 규칙':panel==='leave'?'게임을 나갈까요?':'게임 메뉴'}><header><h2>{panel==='help'?'작은 숫자부터, 여섯 장은 금물':panel==='leave'?'게임을 나갈까요?':'살롱 메뉴'}</h2><IconButton aria-label="닫기" onClick={()=>setPanel(null)}><X size={20}/></IconButton></header>{panel==='help'?<><img src="/assets/new-games/six-nimmt-cover.png" alt=""/><ol><li>모두 손패에서 한 장씩 비공개로 선택한 뒤 동시에 공개합니다.</li><li>작은 숫자부터 놓습니다. 자신의 카드보다 작고 가장 가까운 끝 숫자의 줄에 붙습니다.</li><li>여섯 번째 카드라면 앞의 다섯 장을 벌점으로 받고, 낸 카드가 새 줄을 시작합니다.</li><li>모든 줄보다 작다면 원하는 줄 하나를 가져옵니다. 줄 번호와 벌점을 보고 선택하세요.</li><li>10턴 후 새 라운드. 누군가 누적 66점 이상이면 게임 종료, 가장 낮은 벌점이 승리합니다.</li></ol><p>소머리: 보통 1개 · 5의 배수 2개 · 10의 배수 3개 · 11의 배수 5개 · 55는 7개.</p></>:panel==='leave'?<><p>진행 중인 게임에서 나가면 AI가 내 자리를 이어서 플레이합니다.</p><footer><Button autoFocus onClick={()=>setPanel(null)}>취소</Button><Button style={{background:THEME.destructive,color:THEME.destructiveForeground}} onClick={()=>onLeave?.({immediate:true})}>기권하고 나가기</Button></footer></>:<><RoomVoiceControls voice={webrtc} compact/><p>{stt?.isSTTActive?'음성 자막 사용 중':'음성 채팅을 사용할 수 있습니다.'}</p><p>방 코드 {roomState.code} · {game.players.length}명</p><footer><Button onClick={leave}><LogOut size={16}/> 게임 나가기</Button></footer></>}</Sheet>
  </Shell>;
}
