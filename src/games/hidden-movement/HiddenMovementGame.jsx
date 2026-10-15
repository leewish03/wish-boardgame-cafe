import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { motion, useReducedMotion } from 'framer-motion';
import { THEME } from '../../shared/theme';
import { RoomChat } from '../../shared/RoomChat';
import { RoomVoiceControls } from '../love-letter/ui/GameMenuDrawer';
import MapViewport from './MapViewport';
import GameScreenControls from '../../shared/GameScreenControls';
import SetupTray, { initialDraft, setupTargets, updateSetup } from './SetupTray';
import { ink, colorName, modeName, phaseNames, phaseHelp, legalCommands, commandTarget, commandLabel, commandVia, previewKeys, setupSubmission, eventLabel } from './model';

const Shell=styled.main`height:100%;width:100%;min-width:0;box-sizing:border-box;min-height:0;display:flex;flex-direction:column;background:${THEME.background};color:${THEME.foreground};font-family:${THEME.font.sans};word-break:keep-all;overflow:hidden;button,select,input{font:inherit;}button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid ${THEME.gold};outline-offset:2px;}`;
const Header=styled.header`display:flex;flex-shrink:0;align-items:center;gap:8px;padding:8px;border-bottom:1px solid ${THEME.border};background:${THEME.surfaceCard};img{width:64px;height:48px;object-fit:cover;border-radius:4px;}h1{font:700 clamp(17px,2.3vw,24px) ${THEME.font.serif};margin:0;}p{margin:4px 0 0;font-size:12px;color:${THEME.mutedForeground};}.title{flex:1;min-width:0;}@media(max-width:600px),(max-height:500px){img{display:none;}}@media(orientation:landscape) and (max-height:500px){padding-block:4px;.title{display:flex;align-items:center;gap:12px;}h1{font-size:17px;}p{margin:0;}}@media(max-width:600px){flex-wrap:wrap;justify-content:flex-end;.title{flex-basis:100%;display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;}p{margin:0;}}`;
const Button=styled.button`min-height:44px;min-width:44px;padding:8px 12px;border:1px solid ${p=>p.$active?THEME.goldAntique:THEME.border};border-radius:6px;background:${p=>p.$active?THEME.primary:THEME.surfaceCard};color:${p=>p.$active?THEME.primaryForeground:THEME.foreground};cursor:pointer;font-size:14px;font-weight:700;line-height:1.35;&:hover:not(:disabled){background:${p=>p.$active?THEME.burgundy:THEME.secondary};}&:active:not(:disabled){box-shadow:inset 0 0 0 2px ${THEME.goldAntique};}&:disabled{opacity:.48;cursor:default;}`;
const Layout=styled.div`flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) clamp(240px,28vw,330px);gap:8px;padding:8px;@media(max-width:599px),(max-width:850px) and (orientation:portrait){grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(224px,34%);}@media(orientation:portrait) and (max-height:650px){grid-template-rows:minmax(320px,1fr) minmax(224px,34%);overflow-y:auto;overscroll-behavior:contain;}`;
const BoardArea=styled.section`min-height:0;display:flex;flex-direction:column;gap:8px;min-width:0;`;
const Status=styled.div`display:flex;gap:12px;flex:0 0 auto;overflow-x:auto;align-items:center;font-size:13px;min-height:32px;strong{color:${THEME.burgundy};white-space:nowrap;}span{white-space:nowrap;}`;
const Tray=styled.aside`min-height:0;overflow:auto;overscroll-behavior:contain;background:${THEME.surfaceCard};padding:16px;border:1px solid ${THEME.border};border-radius:${THEME.radius.lg};h2{font:700 20px ${THEME.font.serif};margin:0 0 8px;}h3{font-size:14px;margin:12px 0 6px;}p{font-size:14px;line-height:1.65;margin:8px 0;}select,input{min-height:44px;min-width:0;border:1px solid ${THEME.input};border-radius:6px;padding:6px;background:#fff;color:${THEME.foreground};}select{max-width:100%;}details{font-size:13px;line-height:1.7;margin-top:12px;}summary{min-height:44px;cursor:pointer;padding:12px 0;}@media(max-width:850px){padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom));}`;
const Row=styled.div`display:flex;flex-wrap:wrap;gap:8px;align-items:center;`;
const ActionPanel=styled.div`min-height:0;display:flex;flex-direction:column;overflow:hidden;background:${THEME.surfaceCard};border-radius:${THEME.radius.lg};>aside{flex:1;border:0;border-radius:0;}`;
const TurnHeading=styled.div`flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 12px;padding:10px 12px;border-bottom:1px solid ${THEME.border};h2{font:700 17px ${THEME.font.serif};margin:0;}strong{font-size:13px;color:${THEME.burgundy};}span{font-size:12px;}@media(max-height:500px){padding:6px 8px;}`;
const ActionDock=styled.div`flex:0 0 auto;padding:12px;border-top:1px solid ${THEME.border};background:${THEME.gradients.marbleSlab};box-shadow:0 -4px 16px #090d1608;display:grid;gap:8px;font-size:14px;strong{overflow-wrap:anywhere;} .actions{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;}@media(max-height:500px){padding:8px;gap:4px;}`;
const CommandList=styled.div`display:flex;flex-wrap:wrap;gap:6px;padding:4px 2px;margin:8px 0;`;
const Notice=styled(motion.div)`flex:0 0 auto;max-height:72px;overflow:auto;box-sizing:border-box;padding:8px 12px;border-radius:6px;background:${ink.text};color:#fffdf5;font-size:14px;line-height:1.5;@media(orientation:landscape) and (max-height:500px){max-height:44px;padding:4px 8px;}`;
const Seats=styled.div`display:flex;gap:8px;overflow:auto;flex:0 0 auto;padding:0 8px max(4px,env(safe-area-inset-bottom));font-size:12px;>span{padding:4px 8px;background:${THEME.surfaceCard};border-radius:6px;white-space:nowrap;}b{color:${THEME.burgundy};}`;
const ErrorText=styled.p`color:${THEME.destructive};font-weight:700;`;
const Result=styled.section`padding:12px;background:${ink.paper};border-radius:6px;margin-bottom:12px;h2{font-size:22px;}`;
const ExitDialog=styled.dialog`position:fixed;inset:0;margin:auto;border:1px solid ${THEME.gold};border-radius:${THEME.radius.lg};padding:24px;width:min(420px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box;color:${THEME.foreground};background:${THEME.surfaceCard};font-family:${THEME.font.sans};word-break:keep-all;::backdrop{background:#090d1680;}h2{font:700 22px ${THEME.font.serif};margin:0 0 12px;}p{line-height:1.6;}footer{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;}`;

function TurnClock({expiresAt,serverTime,paused}) {
  const [remaining,setRemaining]=useState(0);
  useEffect(()=>{
    if(!expiresAt||paused)return;
    const offset=(serverTime??Date.now())-Date.now();
    const tick=()=>setRemaining(Math.max(0,Math.ceil((expiresAt-Date.now()-offset)/1000)));
    tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);
  },[expiresAt,serverTime,paused]);
  return expiresAt?<span role="timer" aria-live="off">{paused?'시간 일시정지':`남은 시간 ${remaining}초`}</span>:null;
}

function Help({hall,role}) {
  return <details><summary>규칙 · 내 역할과 지도 읽기</summary><p>{role==='JACK'?'잭은 번호가 있는 장소를 이동합니다. 비밀 경로와 목표는 나에게만 보입니다.':'수사관은 작은 교차로를 이동합니다. 지도에서 금색으로 표시된 장소를 선택해 수색하거나 체포하세요.'}</p><p>모든 수사관의 이동을 마친 뒤 조사합니다. 수색은 지나간 흔적을 찾고, 체포는 현재 위치를 맞혀야 합니다. 수색을 시작해 흔적이 없으면 남은 인접 장소를 계속 수색해야 합니다.</p><p>{hall?'각 구역의 흰색 장소를 하나씩 골라 출발지 외의 세 곳을 방문하세요. 구간마다 15칸 안에 도착하고 수사관의 조사를 살아남아야 합니다. 마차·골목·배는 경기 전체에서 두 번씩 사용합니다. 특수 이동으로 새 목적지에 들어갈 수 없습니다.':'네 번의 밤 동안 범행 후 같은 은신처로 도보 귀환하면 잭이 이깁니다. 경찰은 체포하거나 시간 안의 귀환을 막아야 합니다. 밤마다 마차와 골목 사용권이 새로 주어집니다. 세 번째 밤에는 두 범행의 순서도 비밀로 선택합니다.'}</p><p>지도는 끌어서 이동하고 확대할 수 있습니다. 아래 목적지 버튼으로도 모든 행동을 선택할 수 있습니다. 선택 후 확정해야 서버에 전달됩니다.</p></details>;
}

export default function HiddenMovementGame({roomState,currentUser,socket,webrtc,chatMessages=[],onSendChat,onLeave,onRoomUnavailable}) {
  const game=roomState.game, secret=roomState.mySecret??{}, me=currentUser?.id??currentUser?.userId;
  const hall=game?.gameType==='WHITEHALL', reduced=useReducedMotion();
  const [selected,setSelected]=useState(null),[filter,setFilter]=useState(''),[officer,setOfficer]=useState(''),[origin,setOrigin]=useState(''),[via,setVia]=useState(''),[query,setQuery]=useState('');
  const [focusedKey,setFocusedKey]=useState(null);
  const [draft,setDraft]=useState(()=>initialDraft(secret)),[error,setError]=useState(''),[sending,setSending]=useState(false),[showHelp,setShowHelp]=useState(false),[escape,setEscape]=useState(true),[leaving,setLeaving]=useState(false);
  const inFlight=useRef(false),acked=useRef(new Set()),trayRef=useRef(null),exitRef=useRef(null);
  useEffect(()=>{if(leaving&&!exitRef.current?.open)exitRef.current?.showModal();else if(!leaving&&exitRef.current?.open)exitRef.current.close();},[leaving]);
  const [completed,setCompleted]=useState(null),[lastMessage,setLastMessage]=useState('사건 준비 · 지도의 토큰과 이동 경로를 살펴보세요.');
  const presentation=roomState.presentation, batchId=presentation?.id;
  const events=useMemo(()=>(presentation?.events??[]).filter(e=>e.type!=='JACK_ROUTE'),[presentation?.events]);
  useEffect(()=>{if(events.length)setLastMessage(events.map(e=>eventLabel(e,game.gameType)).join(' · '));},[events,game?.gameType]);
  const pending=Boolean(presentation?.pending&&completed!==batchId);
  useEffect(()=>{setSelected(null);setFilter('');setOrigin('');setVia('');setQuery('');setDraft(initialDraft(secret));setSending(false);inFlight.current=false;},[game?.stateVersion]);
  useEffect(()=>{if(trayRef.current)trayRef.current.scrollTop=0;},[game?.stateVersion]);
  useEffect(()=>{
    const ready=()=>socket?.emit('board:view-ready',{roomCode:roomState.code,userId:me});
    ready();socket?.on('connect',ready);return()=>socket?.off('connect',ready);
  },[socket,roomState.code,me]);
  const acknowledge=useCallback(()=>{
    if(!batchId||acked.current.has(batchId))return;
    acked.current.add(batchId);setCompleted(batchId);
    socket?.emit('board:presentation-ack',{roomCode:roomState.code,userId:me,eventId:batchId});
  },[batchId,socket,roomState.code,me]);
  useEffect(()=>{if(batchId&&presentation?.pending&&!events.length)acknowledge();},[batchId,presentation?.pending,events.length,acknowledge]);
  const send=(command,start=false)=>{
    if(inFlight.current||pending)return;
    inFlight.current=true;setSending(true);setError('');
    const payload={roomCode:roomState.code,userId:me,expectedVersion:game.stateVersion,command:{...command,playerId:me}};
    socket.timeout(10000).emit(start?'board:start':'board:command',payload,(timeout,result)=>{
      inFlight.current=false;setSending(false);
      if(timeout){setError('응답을 받지 못했습니다. 연결 상태를 확인한 뒤 다시 시도하세요.');return;}
      if(result?.success===false){setError(result.error??'행동을 처리하지 못했습니다.');if(['ROOM_NOT_FOUND','SESSION_CONTEXT_MISMATCH','SESSION_NOT_FOUND'].includes(result.code))onRoomUnavailable?.(result);}
    });
  };
  const canEscape=game?.gameType==='WHITECHAPEL'&&selected?.type==='JACK_MOVE'&&selected.mode==='normal'&&selected.to===secret.hideout;
  const commands=useMemo(()=>game?legalCommands(game,secret):[],[game,secret]);
  const setup=game?setupTargets(game,secret,draft):null;
  const figures=[...new Set(commands.map(c=>c.officerId??c.pawnId).filter(Boolean))];
  const activeOfficer=figures.includes(officer)?officer:figures[0];
  const actorCommands=commands.filter(c=>!activeOfficer||(c.officerId??c.pawnId)===activeOfficer);
  const modes=[...new Set(actorCommands.map(c=>c.mode??c.type))];
  const origins=[...new Set(actorCommands.map(c=>c.from).filter(n=>n!=null))];
  const activeFilter=modes.includes(filter)?filter:modes[0];
  const activeOrigin=origins.some(n=>String(n)===origin)?Number(origin):origins[0];
  useEffect(()=>{setQuery('');setSelected(null);setVia('');},[activeOfficer,activeFilter,activeOrigin]);
  const modeCommands=actorCommands.filter(c=>(!activeFilter||(c.mode??c.type)===activeFilter)&&(!origins.length||c.from===activeOrigin));
  const vias=[...new Set(modeCommands.map(commandVia).filter(n=>n!=null))];
  const activeVia=vias.find(n=>String(n)===String(via));
  const choosingVia=vias.length>0&&activeVia==null;
  const viaLabel=game?.playPhase==='KILL_OR_WAIT'?'첫 범행 장소':'경유지';
  const filtered=modeCommands.filter(c=>!vias.length||commandVia(c)===activeVia);
  const visible=filtered.filter(c=>!query||commandLabel(c,game.gameType).includes(query.trim()));
  const targets=setup??new Set(choosingVia?vias.map(n=>`n:${n}`):filtered.map(commandTarget).filter(Boolean));
  const disabled=sending||pending||roomState.isPaused||socket?.connected===false;
  const ownTurn=Boolean(setup||commands.length);
  const forcedWomen=Array.isArray(secret.legal?.womanNumbers)&&secret.legal.womanNumbers.length===secret.legal.women;
  const placingPatrols=Boolean(secret.legal?.patrolStarts&&draft.values.length===7&&!draft.editPositions);
  const draftPatrols=placingPatrols?draft.values.map(position=>({position,officerId:draft.assignments[position]??null})):[];
  const selectedKeys=setup?(forcedWomen?draft.real:draft.values??[]).map(n=>`${secret.legal.patrolStarts?'c':'n'}:${n}`):[commandTarget(selected)].filter(Boolean);
  const onPick=key=>{
    if(disabled)return;
    if(setup){setDraft(updateSetup(game,secret,draft,key));return;}
    if(choosingVia){setVia(key.slice(2));setSelected(null);return;}
    const candidates=filtered.filter(c=>commandTarget(c)===key);
    setSelected(candidates[0]??null);
  };
  const submission=setupSubmission(secret,draft);
  const focusKey=activeOfficer?`c:${game?.police?.find(p=>p.id===activeOfficer)?.position}`:secret.role==='JACK'&&secret.position!=null?`n:${secret.position}`:null;
  const preview=previewKeys(game,secret,selected);
  const actors=(game?.pendingActors??(hall&&['DEPLOY','POLICE_MOVE','POLICE_ACTION'].includes(game.playPhase)?[game.police[game.pawnIndex]?.controllerId]:[game?.jackPlayerId])).map(id=>game?.players.find(p=>p.id===id)?.nickname).filter(Boolean);
  if(!game)return <Shell><p>사건 지도를 준비하고 있습니다.</p><Button onClick={onLeave}>방 나가기</Button></Shell>;
  const ending=game.matchState==='GAME_OVER'||game.matchState==='ROUND_END',host=game.players.some(p=>p.id===me&&p.isHost);
  const title=hall?'화이트홀 미스터리':'화이트채플에서 온 편지';
  return <Shell style={{paddingLeft:'env(safe-area-inset-left)',paddingRight:'env(safe-area-inset-right)'}}>
    <Header><img src={`/assets/new-games/${hall?'whitehall':'whitechapel'}-cover.png`} alt=""/><div className="title"><h1>{title}</h1><p>{secret.role==='JACK'?'잭 · 비밀 경로':'수사관 · 공동 수사'} · 방 {roomState.code}</p></div><GameScreenControls/><Button onClick={()=>setShowHelp(v=>!v)} aria-expanded={showHelp}>안내</Button><Button onClick={()=>game.matchState==='GAME_OVER'?onLeave({immediate:true}):setLeaving(true)}>나가기</Button><RoomChat mode="sheet" launcherPlacement="inline" messages={chatMessages} onSend={onSendChat} currentUserId={me}/></Header>
    <Layout><BoardArea>
      <Status><strong>{hall?`${game.roundNumber}번째 추적`:`제${game.roundNumber}야`}</strong><span>{hall?`이동 ${game.moveCount??0} / 15`:`남은 이동 ${Math.max(0,15-(game.track??0))}칸`}</span>{Object.entries(game.specials??{}).map(([k,v])=><span key={k}>{modeName[k]} {v}</span>)}{!hall&&<span>기다림 {game.wait}/5</span>}{(hall?game.revealed:game.nightCrimes)?.length>0&&<span>{hall?'공개된 발견 장소':'이번 밤 사건'}: {(hall?game.revealed:game.nightCrimes).join(' · ')}번</span>}<TurnClock expiresAt={roomState.turnExpiresAt} serverTime={roomState.serverTime} paused={roomState.isPaused}/></Status>
      <MapViewport game={game} secret={secret} targets={targets} selectedKeys={selectedKeys} onPick={onPick} focusKey={focusKey} focusedKey={focusedKey} preview={preview} draftPatrols={draftPatrols} activeOfficer={activeOfficer} selectableOfficers={figures} onSelectOfficer={id=>{setOfficer(id);setSelected(null);setVia('');}} events={presentation?.events??[]} batchId={batchId} disabled={disabled}/>
      <Notice key={batchId??'initial'} role="status" aria-live="polite" initial={{opacity:.65}} animate={{opacity:1}} transition={{duration:reduced ? .12 : 1.1}} onAnimationComplete={acknowledge}>{events.length?events.map(e=>eventLabel(e,game.gameType)).join(' · '):lastMessage}</Notice>
    </BoardArea><ActionPanel><TurnHeading><h2>{phaseNames[game.playPhase]??'사건 진행'}</h2><strong>{ownTurn&&!ending?`내 차례${activeOfficer?` · ${colorName[activeOfficer.toLowerCase()]} 경찰`:''}`:ending?'':`${actors.join(' · ')||'상대'}의 차례`}</strong>{pending&&<span>테이블 정리 중</span>}{sending&&<span>전달 중…</span>}</TurnHeading><Tray ref={trayRef} aria-label="현재 행동">
      {ending&&<Result><h2>{game.matchState==='ROUND_END'?'잭이 귀환했습니다':game.outcome?.winner==='JACK'?'잭의 승리':'수사관의 승리'}</h2><p>{game.matchState==='ROUND_END'?`${game.roundNumber}번째 밤 종료. 다음 밤에는 순찰을 다시 배치합니다.`:({ARREST:'잭을 현장에서 검거했습니다.',TIME_EXPIRED:'제한 시간 안에 목적지에 도착하지 못했습니다.',TRAPPED:'모든 도주로가 막혔습니다.',BLOCKED:'모든 도주로가 막혔습니다.',FOUR_ESCAPES:'잭이 네 번의 밤 모두 은신처로 돌아갔습니다.',ALL_DISCOVERIES:'잭이 모든 발견 장소에 도착했습니다.'}[game.outcome?.reason]??'수사가 끝났습니다.')}</p>{host&&<Button disabled={disabled} onClick={()=>game.matchState==='ROUND_END'?send({type:'ADVANCE_ROUND'}):send({},true)}>{game.matchState==='ROUND_END'?'다음 밤 시작':'다시 플레이'}</Button>}</Result>}
      {socket?.connected===false&&<ErrorText role="alert">연결이 끊겼습니다. 다시 연결되면 이어집니다.</ErrorText>}
      {roomState.isPaused&&<ErrorText role="status">참가자의 재접속을 기다립니다.</ErrorText>}
      {error&&<ErrorText role="alert">{error}</ErrorText>}
      {showHelp&&<section aria-label="살롱 안내"><h3>음성 대화</h3><RoomVoiceControls voice={webrtc} compact/><Help hall={hall} role={secret.role}/></section>}
      {!ending&&!placingPatrols&&<p>{forcedWomen?`배치 장소는 정해져 있습니다. 지도에서 실제 여성 ${secret.legal.real}곳을 고르세요.`:choosingVia?`지도에서 ${viaLabel}를 고르세요.`:vias.length?`${activeVia}번 → 지도에서 두 번째 장소를 고르세요.`:game.playPhase==='JACK_MOVE'?'지도에서 도착할 번호를 고르세요.':phaseHelp[game.playPhase]??'다음 행동을 기다려 주세요.'}</p>}
      {setup?<div onBlur={()=>setFocusedKey(null)}><SetupTray game={game} secret={secret} draft={draft} setDraft={setDraft} disabled={disabled} Button={Button} Row={Row} onFocusTarget={setFocusedKey}/></div>:!ending&&ownTurn?<>
        {figures.length>1&&<Row>{figures.map(id=><Button key={id} $active={id===activeOfficer} aria-pressed={id===activeOfficer} onClick={()=>{setOfficer(id);setSelected(null);}}>{colorName[id.toLowerCase()]} 경찰</Button>)}</Row>}
        {origins.length>1&&<label>이동할 여성 <select value={activeOrigin} onChange={e=>{setOrigin(e.target.value);setSelected(null);}}>{origins.map(n=><option key={n} value={n}>{n}번 여성</option>)}</select></label>}
        {modes.length>1&&<Row>{modes.map(m=><Button key={m} $active={m===activeFilter} aria-pressed={m===activeFilter} onClick={()=>{setFilter(m);setSelected(null);setVia('');}}>{modeName[m]??({SEARCH:'수색',ARREST:'체포',PASS:'마치기',END_ACTION:'마치기',WAIT:'기다리기',MURDER:'범행'}[m]??m)}</Button>)}</Row>}
        {choosingVia&&<Row>{vias.map(n=><Button key={n} disabled={disabled} onFocus={()=>setFocusedKey(`n:${n}`)} onBlur={()=>setFocusedKey(null)} onClick={()=>setVia(String(n))}>{n}번 {viaLabel}</Button>)}</Row>}
        {!choosingVia&&<details key={`${game.playPhase}-${activeOfficer}-${activeFilter}`} open={filtered.every(c=>!commandTarget(c))?true:undefined}><summary>번호 목록에서 선택 ({visible.length})</summary>
          {(filtered.length>15||query)&&<Row><label>번호로 찾기 <input aria-label="목적지 번호 찾기" inputMode="numeric" value={query} onChange={e=>setQuery(e.target.value)} placeholder="번호" style={{width:90}}/></label>{query&&<Button onClick={()=>setQuery('')}>검색 지우기</Button>}</Row>}
          {!visible.length&&query&&<p role="status">일치하는 목적지가 없습니다. 검색을 지워 다시 선택하세요.</p>}
          <CommandList aria-label="가능한 행동">{visible.map(c=><Button key={JSON.stringify(c)} disabled={disabled} $active={JSON.stringify(c)===JSON.stringify(selected)} aria-pressed={JSON.stringify(c)===JSON.stringify(selected)} onFocus={()=>setFocusedKey(commandTarget(c))} onBlur={()=>setFocusedKey(null)} onClick={()=>setSelected(c)}>{commandLabel(c,game.gameType)}</Button>)}</CommandList>
        </details>}
      </>:!ending&&<p>상대가 행동하고 있습니다. 공개된 흔적과 수사관의 위치를 살펴보세요.</p>}
      {!showHelp&&<Help hall={hall} role={secret.role}/>}
      {secret.role==='JACK'&&<details><summary>나만 보는 수첩</summary>{secret.hideout!=null&&<p>은신처: {secret.hideout}번</p>}{secret.discoveries&&<p>목적지: {secret.discoveries.join(' · ')}</p>}<p>이동 기록: {(secret.route??secret.trail??[]).join(' → ')||'아직 출발하지 않았습니다.'}</p></details>}
    </Tray>
      {setup&&submission&&<ActionDock aria-label="배치 확정"><Button $active disabled={disabled||!submission.ready} onClick={()=>send(submission.command)}>{sending?'전달 중…':submission.label}</Button></ActionDock>}
      {!setup&&(!ending||pending)&&<ActionDock aria-label="행동 확정">
        <strong aria-live="polite">{!ownTurn?'상대의 행동을 기다립니다':selected?commandLabel(selected,game.gameType):choosingVia?`① ${viaLabel} 선택`:vias.length?`① ${activeVia}번 → ② 두 번째 장소 선택`:filtered.every(c=>!commandTarget(c))?'위에서 행동을 선택하세요':'지도에서 행동할 곳을 선택하세요'}</strong>
        {canEscape&&<label><input type="checkbox" checked={escape} onChange={e=>setEscape(e.target.checked)}/> 도착 후 탈출 선언</label>}
        <div className="actions"><Button disabled={disabled||!ownTurn||(!selected&&activeVia==null)} onClick={()=>{if(selected)setSelected(null);else setVia('');}}>되돌리기</Button><Button $active disabled={disabled||!ownTurn||!selected} onClick={()=>send(canEscape?{...selected,escape}:selected)}>{sending?'전달 중…':'선택한 행동 확정'}</Button></div>
      </ActionDock>}
    </ActionPanel></Layout>
    <Seats aria-label="참가자">{game.players.map(p=><span key={p.id}><b>{p.id===me?'나 · ':''}{p.nickname}</b> · {p.id===game.jackPlayerId?'잭':(game.police??[]).filter(o=>(o.ownerId??o.controllerId)===p.id).map(o=>colorName[o.id.toLowerCase()]).join(' · ')}{p.isBot?' · AI':''}</span>)}</Seats>
    <ExitDialog ref={exitRef} aria-labelledby="map-exit-title" onCancel={()=>setLeaving(false)} onClose={()=>setLeaving(false)}><h2 id="map-exit-title">게임을 나갈까요?</h2><p>진행 중인 게임에서는 AI가 내 자리를 이어받습니다.</p><footer><Button autoFocus onClick={()=>setLeaving(false)}>계속 플레이</Button><Button $active style={{background:THEME.destructive,borderColor:THEME.destructive}} onClick={()=>{setLeaving(false);onLeave({immediate:true});}}>기권하고 나가기</Button></footer></ExitDialog>
  </Shell>;
}
