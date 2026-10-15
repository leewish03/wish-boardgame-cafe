import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
const {LoveLetterGame}=await import(/* @vite-ignore */ location.search.includes('before') ? '/.omo/evidence/ui-ux/task-5-baseline/src/games/love-letter/ui/LoveLetterGame.tsx' : '/src/games/love-letter/ui/LoveLetterGame.tsx');
import { CARD_DEFINITIONS } from '../packages/love-letter-core/src/cards';
import type { CardValue } from '../packages/love-letter-core/src/types';

const card = (value: CardValue, id: string) => ({ ...CARD_DEFINITIONS[value], value, id });
const listeners = new Map<string, Set<(data?: unknown) => void>>();
const commands: unknown[] = [];
const setOutput=(selector:string,text:string)=>{const element=document.querySelector(selector);if(element)element.textContent=text;};
let mode = 'drop';
let version = 10;
let copyMode = 'reject';
let state: ReturnType<typeof makeState> & {isPaused?:boolean;pausedPlayerId?:string;pauseExpiresAt?:number} = makeState();
function makeState() {
 return { code: 'LLTEST', deckCount: 10, matchState: 'PLAYING', playPhase: 'TURN_INPUT', roundNumber: 1, config: {targetTokens:4,turnTimeoutSeconds:0,maxPlayers:4,minPlayers:2}, stateVersion:version, currentTurnPlayerId:'me', turnExpiresAt:0, turnStartedAt:Date.now(), lastAction:{actorId:'me',actionId:'previous'}, players:[{id:'me',nickname:'테스트 플레이어',tokens:0,isHost:true,cardCount:2,discardPile:[]},{id:'other',nickname:'긴 이름의 상대 플레이어',tokens:0,cardCount:1,isProtected:true,discardPile:[card(1,'old-guard')]}], mySecretHand:[card(2,'priest'),card(4,'handmaid')], roundWinnerIds:[], matchWinnerId:null };
}
function dispatch(event: string, data?: unknown) { for (const fn of [...(listeners.get(event)||[])]) fn(data); }
function snapshot() { dispatch('game:snapshot',{roomId:'LLTEST',stateVersion:state.stateVersion,serverTime:Date.now(),publicState:state,privateState:{id:'me',hand:state.mySecretHand}}); }
const socket = { connected:true, on(event:string, fn:(data?:unknown)=>void){const set=listeners.get(event)||new Set();set.add(fn);listeners.set(event,set);},off(event:string,fn:(data?:unknown)=>void){listeners.get(event)?.delete(fn);},emit(event:string,payload: {command?:{cardId:string}},callback?:(result:{success:boolean})=>void){
 if(event==='game:view-ready'){queueMicrotask(snapshot);return;}
 if(event==='game:command') { commands.push(payload); setOutput('#command-count',String(commands.length)); if(mode==='drop')return;
 const played=state.mySecretHand.find(item=>item.id===payload.command?.cardId); if(!played){callback?.({success:false});return;}
 state={...state,stateVersion:++version,mySecretHand:state.mySecretHand.filter(item=>item.id!==played.id),players:state.players.map(player=>player.id==='me'?{...player,cardCount:1,discardPile:[...player.discardPile,played]}:player)};snapshot();if(mode!=='ack-drop')callback?.({success:true});
 }
}};
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise<void>((resolve,reject)=>setTimeout(()=>copyMode==='reject'?reject(new DOMException('Fixture denial','NotAllowedError')):resolve(),700))}});
function Fixture() {
 const [room,setRoom]=useState(state);
 const [joined,setJoined]=useState(false);const [mic,setMic]=useState(false);const [speaker,setSpeaker]=useState(true);
 useEffect(()=>{const refresh=()=>setRoom({...state});socket.on('fixture:room',refresh);return()=>socket.off('fixture:room',refresh);},[]);
 const voice={isVoiceJoined:joined,isMicOn:mic,isSpeakerOn:speaker,voiceStatus:joined?'joined':'idle',joinVoice:()=>setJoined(true),leaveVoice:()=>{setJoined(false);setMic(false);},toggleMic:()=>setMic(value=>!value),toggleSpeaker:()=>setSpeaker(value=>!value)};
 return <><LoveLetterGame roomState={room} currentUser={{id:'me',nickname:'테스트 플레이어'}} socket={socket} webrtc={voice} onLeave={()=>{setOutput('#fixture-status','LEFT');}}/>
 <details style={{position:'fixed',top:4,left:4,zIndex:5000,background:'white',border:'1px solid #777',padding:4,maxWidth:230,fontSize:12}}><summary>격리 QA · 가짜 음성 · 전송 <span id="command-count">0</span></summary><div onMouseDown={event=>event.preventDefault()} style={{display:'grid',gap:4}}>
 <button onClick={()=>{mode='drop';state=makeState();snapshot();}}>명령 누락 초기화</button>
 <button onClick={()=>{mode='ack-drop';state=makeState();snapshot();}}>ACK 누락 초기화</button>
 <button onClick={()=>{state={...state,stateVersion:++version,players:state.players.map(player=>player.id==='other'?{...player,discardPile:[...player.discardPile,card(5,'new-prince')]}:player)};snapshot();}}>상대 공개 버림 추가</button>
 <button onClick={()=>{state={...state,isPaused:true,pausedPlayerId:'other',pauseExpiresAt:Date.now()+60000};dispatch('fixture:room');}}>일시 정지</button>
 <button onClick={()=>{state={...state,isPaused:false};dispatch('fixture:room');}}>재개</button>
 <button onClick={()=>{socket.connected=false;dispatch('disconnect');}}>연결 중단</button>
 <button onClick={()=>{socket.connected=true;dispatch('connect');snapshot();}}>재연결</button>
 <button onClick={()=>{copyMode='resolve';}}>복사 성공 설정</button><output id="fixture-status">READY</output>
 </div></details></>;
}
const root=document.getElementById('root');
if(root){const reactRoot=createRoot(root);reactRoot.render(<Fixture/>);if(import.meta.hot)import.meta.hot.dispose(()=>reactRoot.unmount());}
