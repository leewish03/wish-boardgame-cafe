import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Game from '../src/games/six-nimmt/SixNimmtGame';

const params=new URLSearchParams(location.search),kind=params.get('kind')||'match';
const count=kind==='two'?2:10,guest=kind==='guest',disconnect=kind==='disconnect';
const players=Array.from({length:count},(_,i)=>({id:`p${i}`,nickname:count===2?`참가자 ${i+1}`:`매우 긴 이름을 가진 살롱 참가자 ${i+1} — 동점 확인`,score:i<2?7:20+i,roundScore:i,handCount:0}));
const finalRoom={code:'TERMINAL-QA',hostId:'p0',game:{stateVersion:100,selectionVersion:10,matchState:kind==='round'?'ROUND_END':'GAME_OVER',playPhase:'RESOLVING',roundNumber:4,turnNumber:10,config:{deckSize:count*10+4},players,rows:[[1],[20],[30],[40]],queue:[],outcome:kind==='round'?null:{winnerIds:['p0','p1']}},mySecret:{hand:[],legalActions:[]},presentation:{pending:false,id:null,events:[]}};
const startRoom=disconnect?{...finalRoom,game:{...finalRoom.game,matchState:'PLAYING',playPhase:'CHOOSING_ROW',pendingRowPlayerId:'p0',players:players.map((p,i)=>i===0?{...p,score:60,roundScore:0}:p),rows:[[10,11,12,13,14],[20],[30],[40]],queue:[{card:1,playerId:'p0'}]},mySecret:{hand:[],legalActions:[{type:'CHOOSE_ROW',rowIndex:0}]}}:finalRoom;
function Fixture(){
  const [room,setRoom]=useState(startRoom),[left,setLeft]=useState(false),[fault,setFault]=useState(false),[calls,setCalls]=useState([]),timer=useRef(null);
  const socket=useRef(null);
  if(!socket.current)socket.current={connected:true,on(){},off(){},timeout(){return{emit(event,payload,callback){
    setCalls(previous=>[...previous,{event,payload}]);
    if(event==='board:command'&&payload.command.type==='CHOOSE_ROW'){
      setRoom(current=>({...current,game:{...current.game,matchState:'GAME_OVER',playPhase:'RESOLVING',pendingRowPlayerId:null,players:current.game.players.map((p,i)=>i===0?{...p,score:71,roundScore:11}:p),rows:[[1],[20],[30],[40]],queue:[],outcome:{winnerIds:['p1']}},presentation:{id:'101:final',pending:true,events:[{type:'ROW_TAKEN',rowIndex:0,card:1,cards:[10,11,12,13,14],playerId:'p0',points:11}]}}));
      timer.current=setTimeout(()=>{socket.current.connected=false;setFault(true);setRoom(current=>({...current,isPaused:true}));},100);
    }
    callback?.(null,{success:true});
  }};}};
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  if(left)return <main><h1>격리 테스트: 나가기 완료</h1><pre>{JSON.stringify(calls,null,2)}</pre></main>;
  return <><Game roomState={room} currentUser={{id:guest?'p1':'p0'}} socket={socket.current} onLeave={()=>setLeft(true)}/>
    {fault&&<button style={{position:'fixed',top:4,left:4,zIndex:99999,minHeight:44}} onClick={()=>{socket.current.connected=true;setFault(false);setRoom(current=>({...current,isPaused:false,game:{...current.game,stateVersion:101},presentation:{id:null,pending:false,events:[]}}));}}>격리 QA: 재연결 후 정착</button>}
    <output id="fixture-commands" hidden>{JSON.stringify(calls.filter(c=>c.event==='board:start'||c.event==='board:command'))}</output>
  </>;
}
const root=createRoot(document.getElementById('root'));root.render(<Fixture/>);if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
