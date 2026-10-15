import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import NimmtCard from '../src/games/six-nimmt/NimmtCard';
const {default:Game}=await import(/* @vite-ignore */ location.search.includes('before')?'/.omo/evidence/ui-ux/task-7-baseline.mjs':'/src/games/six-nimmt/SixNimmtGame.jsx');
const serverNow=()=>Date.now()+3600000;
let version=100;
const initial=()=>({code:'ISOLATED',hostId:'p0',serverTime:serverNow(),turnExpiresAt:serverNow()+30000,turnTimeLimit:30,
  game:{stateVersion:version,selectionVersion:1,matchState:'PLAYING',playPhase:'SELECTING',roundNumber:1,turnNumber:1,config:{deckSize:104},players:Array.from({length:10},(_,i)=>({id:`p${i}`,nickname:`${i+1}번 긴 이름의 플레이어`,score:0,roundScore:0,handCount:10})),rows:[[12,13,14,15,16],[20],[30],[40]],queue:[]},
  mySecret:{hand:[1,5,6,10,11,55],selectedCard:null,legalActions:[1,5,6,10,11,55].map(card=>({type:'SELECT_CARD',card}))},presentation:{id:null,pending:false,events:[]}});
const acknowledgements=[];
const timings=[];
let flight=null;
const socket={connected:true,on(){},off(){},timeout(){return {emit(event,payload,callback){if(event==='board:presentation-ack'){acknowledgements.push(payload.eventId);if(flight?.id===payload.eventId){flight.ackMs=performance.now()-flight.start;timings.push(flight);flight=null;}}callback?.(null,{success:true});}};}};
function Fixture(){
  const [room,setRoom]=useState(initial),[palette,setPalette]=useState(false),[identity,setIdentity]=useState(null),[ack,setAck]=useState([]);
  const previous=useRef(null);
  useEffect(()=>{const nodes=['[aria-label="참가자와 벌점"]','[aria-label="네 개의 카드 줄"]'].map(selector=>document.querySelector(selector));if(previous.current)setIdentity(nodes.map((node,i)=>({same:node===previous.current.nodes[i],scroll:node?.scrollLeft,previousScroll:previous.current.scroll[i]})));previous.current={nodes,scroll:nodes.map(n=>n?.scrollLeft)};},[room.game.stateVersion]);
  useEffect(()=>{const timer=setInterval(()=>setAck([...acknowledgements]),200);return()=>clearInterval(timer);},[]);
  const update=fn=>{previous.current={nodes:['[aria-label="참가자와 벌점"]','[aria-label="네 개의 카드 줄"]'].map(selector=>document.querySelector(selector)),scroll:['[aria-label="참가자와 벌점"]','[aria-label="네 개의 카드 줄"]'].map(selector=>document.querySelector(selector)?.scrollLeft)};setRoom(current=>{const next=fn(structuredClone(current));return {...next,serverTime:serverNow(),game:{...next.game,stateVersion:++version}};});};
  const travel=card=>{
    const id=`${version+1}:move`;flight={id,start:performance.now(),frames:[],card};let last=flight.start;
    const sample=now=>{if(flight?.id!==id)return;const node=document.querySelector(`[aria-label="${card}, 소머리 1개"]`);const rect=node?.getBoundingClientRect();flight.frames.push({ms:now-flight.start,gap:now-last,x:rect?.x,y:rect?.y});last=now;if(now-flight.start<2500)requestAnimationFrame(sample);};requestAnimationFrame(sample);
    update(current=>({...current,game:{...current.game,rows:[[12,card],[20],[30],[40]],queue:[],playPhase:'RESOLVING'},presentation:{id,pending:true,events:[{type:'CARD_PLACED',rowIndex:0,card,playerId:'p0'}]}}));
  };
  return <><Game roomState={room} currentUser={{id:'p0'}} socket={socket}/><details style={{position:'fixed',top:4,left:4,zIndex:9000,background:'white',border:'1px solid #777',padding:4,maxWidth:280,maxHeight:'90vh',overflow:'auto',fontSize:12}}><summary>격리 님트 QA · ACK {ack.length}</summary><div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:4,overflowWrap:'anywhere'}}>
    <button onClick={()=>{socket.connected=true;acknowledgements.length=0;setRoom(initial());}}>초기화</button>
    <button onClick={()=>update(current=>({...current,game:{...current.game,players:current.game.players.map(p=>p.id==='p9'?{...p,selected:true}:p)}}))}>일반 스냅샷</button>
    <button onClick={()=>update(current=>({...current,mySecret:{...current.mySecret,selectedCard:55},game:{...current.game,players:current.game.players.map(p=>({...p,selected:true}))}}))}>뒷면 선택</button>
    <button onClick={()=>travel(17)}>이동 A</button><button onClick={()=>travel(18)}>이동 B</button>
    <button onClick={()=>update(current=>current)}>동일 이벤트 재전송</button>
    <button onClick={()=>update(current=>({...current,presentation:{id:null,pending:false,events:[]},game:{...current.game,playPhase:'SELECTING'},turnExpiresAt:serverNow()+30000}))}>정착</button>
    <button onClick={()=>update(current=>({...current,game:{...current.game,playPhase:'CHOOSING_ROW',pendingRowPlayerId:'p0',queue:[{card:1,playerId:'p0'}]},presentation:{pending:false,events:[]},turnExpiresAt:serverNow()+5000}))}>줄 시간 5초</button>
    <button onClick={()=>update(current=>({...current,isPaused:true}))}>일시정지</button>
    <button onClick={()=>update(current=>({...current,isPaused:false,turnExpiresAt:serverNow()+30000}))}>재개</button>
    <button onClick={()=>{socket.connected=false;update(current=>current);}}>연결 중단</button>
    <button onClick={()=>{socket.connected=true;update(current=>({...current,turnExpiresAt:serverNow()+15000}));}}>재연결</button>
    <button onClick={()=>update(current=>({...current,turnTimeLimit:0}))}>무제한</button>
    <button onClick={()=>setPalette(value=>!value)}>카드 크기 비교</button>
    <output id="identity">{JSON.stringify(identity)}</output><output id="acks">{JSON.stringify(ack)}</output><output id="timings">{JSON.stringify(timings)}</output>
  </div></details>{palette&&<section aria-label="카드 크기 비교" style={{position:'fixed',inset:0,zIndex:10000,overflow:'auto',background:'white',padding:12}}><button onClick={()=>setPalette(false)}>비교 닫기</button>{[44,52,68].map(width=><div key={width}><h2>{width}px</h2><div style={{display:'flex',gap:8,flexWrap:'wrap','--card-w':`${width}px`,'--card-h':`${width===44?52:width===52?76:94}px`}}>{[1,5,10,11,55,6].map(card=><NimmtCard key={card} card={card}/>)}<NimmtCard back/></div></div>)}</section>}</>;
}
const root=createRoot(document.getElementById('root'));root.render(<Fixture/>);if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
