import assert from 'node:assert/strict';
import React from 'react';
import { createRequire } from 'node:module';
import { THEME } from '../src/shared/theme.js';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as presentation from '../src/games/dalmuti/presentationState.js';

function hookRuntime() {
  const slots=[];let cursor=0,effects=[],cleanups=[];
  const changed=(a,b)=>!a||b.some((value,index)=>!Object.is(value,a[index]));
  const hooks={ ...React,
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(value){const i=cursor++;return slots[i]??(slots[i]={current:value});},
    useReducer(){cursor++;return[0,()=>{}];},
    useCallback(fn,deps){const i=cursor++;if(!slots[i]||changed(slots[i].deps,deps))slots[i]={deps,fn};return slots[i].fn;},
    useEffect(fn,deps){const i=cursor++;if(changed(slots[i],deps)){slots[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});}},
  };
  hooks.useLayoutEffect=hooks.useEffect;
  hooks.useMemo=(fn,deps)=>hooks.useCallback(fn,deps)();
  return {hooks,render(fn){cursor=0;const value=fn();while(effects.length)effects.shift()();return value;},cleanup(){cleanups.forEach(fn=>fn?.());}};
}
const windowEvents=new Map();
globalThis.window={addEventListener:(event,fn)=>windowEvents.set(event,fn),removeEventListener:event=>windowEvents.delete(event)};
const listeners=new Map(),emitted=[];
const socket={connected:true,on:(event,fn)=>listeners.set(event,fn),off:event=>listeners.delete(event),emit:(event,payload)=>emitted.push({event,payload})};
const runtime=hookRuntime(),module={exports:{}};
const source=readFileSync(process.env.DAL_HOOK_SOURCE||'src/games/dalmuti/useDalmutiPresentation.js','utf8');
new Function('require','module','exports',transformSync(source,{format:'cjs'}).code)(name=>name==='react'?runtime.hooks:presentation,module,module.exports);
const room=(version,pending=false)=>({code:'TABLE',stateVersion:version,presentationPending:pending,presentationBatch:pending?{eventId:`event${version}`}:null,dalmuti:{roundNumber:1,players:[{id:'p0',handCount:3},{id:'p1',handCount:3}],hierarchy:['p0','p1'],trick:{sets:[],passPlayerIds:[],completedCount:0},matchState:'PLAYING'}});
let state=room(1),result;
const render=()=>result=runtime.render(()=>module.exports.useDalmutiPresentation(socket,state));
const receive=next=>{state=next;listeners.get('room:state')?.(next);render();};
try {
 render();receive(state);emitted.length=0;
 for(const [index,type] of ['SET_PLAYED','TAX_COMPLETED','MERCHANT_EXCHANGED','GREAT_REVOLUTION','ROUND_DEALT'].entries()){
  const version=index+2;
  const event={type,id:`event${version}`,actorId:'p0',targetId:'p1',rank:7,count:1,handCount:2,hierarchy:['p1','p0'],pairs:[]};
  listeners.get('dalmuti:event')({eventId:event.id,stateVersion:version,eventIndex:0,eventCount:1,event});
  receive(room(version,true));
  const active=result.active;assert.ok(active,`${type} starts`);
  const before=emitted.length;windowEvents.get('resize')?.();
  console.log(JSON.stringify({scenario:type,eventId:active.eventId,generation:active.generation,resizeEmissions:emitted.slice(before)}));
  receive(state);
  console.log(JSON.stringify({scenario:type,afterSnapshot:result.active?.eventId??null,emitted:emitted.slice(before)}));
  assert.equal(emitted.length,before,'layout change must not emit view-ready or ACK');
  assert.equal(result.active.eventId,active.eventId,'layout cannot cancel active event');
  assert.equal(result.active.generation,active.generation,'layout cannot invalidate callback generation');
  result.finish(active.eventId,active.generation);render();
  result.finish(active.eventId,active.generation);render();
  assert.equal(emitted.filter(x=>x.event==='dalmuti:presentation-ack'&&x.payload.eventId===event.id).length,1,'completion ACK exactly once');
  receive(room(version));
 }
 console.log('PASS resize preserves five presentation types and exactly-once completion');
 const event={eventId:'interrupted',stateVersion:8,eventIndex:0,eventCount:1,event:{id:'interrupted',type:'SET_PLAYED',actorId:'p0',rank:4,count:1,handCount:1}};
 listeners.get('dalmuti:event')(event);receive(room(8,true));const interrupted=result.active;
 socket.connected=false;listeners.get('disconnect')();render();assert.equal(result.active,null);
 const before=emitted.length;result.finish(interrupted.eventId,interrupted.generation);assert.equal(emitted.length,before,'late completion after disconnect cannot ACK');
 socket.connected=true;listeners.get('connect')();assert.equal(emitted.at(-1).event,'dalmuti:view-ready');
 receive({...room(9,true),presentationBatch:{eventId:'recovered'}});
 assert.equal(result.active,null);assert.equal(result.visualRoom.stateVersion,9);
 assert.equal(emitted.at(-1).payload.eventId,'recovered');
 console.log('PASS disconnect clears old generation; reconnect converges through view-ready');
} finally {runtime.cleanup();delete globalThis.window;}

const require=createRequire(import.meta.url),styledModule=require('styled-components');
const styled=Object.assign(styledModule.default,styledModule);
const all=tree=>tree&&typeof tree==='object'?[tree,...React.Children.toArray(tree.props?.children).flatMap(all)]:[];
function loadComponent(file,hooks,dependencies={}){
 const loaded={exports:{}};
 const built=transformSync(readFileSync(file,'utf8'),{loader:'jsx',format:'cjs'}).code;
 new Function('require','module','exports',built)(name=>{
  if(name.startsWith('/'))name=name.replace('/src/shared/','../../shared/').replace('/src/games/dalmuti/','./').replace('/packages/','../../../packages/').replace('/src/games/love-letter/','../love-letter/');
  name=name.replace('./task10-hook-before.js','./useDalmutiPresentation.js').replace('./task10-motion-before.jsx','./DalmutiMotionLayer.jsx').replace('./task10-results-before.jsx','./DalmutiResults.jsx');
  if(name==='react')return hooks;
  if(name==='styled-components')return styled;
  if(name==='../../shared/theme')return{THEME};
  if(name in dependencies)return dependencies[name];
  return require(name);
 },loaded,loaded.exports);
 return loaded.exports;
}
const commandRuntime=hookRuntime(),acks=[],commandEvents=new Map();
const commandSocket={connected:true,on:(event,fn)=>commandEvents.set(event,fn),off:event=>commandEvents.delete(event),emit:(event,payload,ack)=>acks.push({event,payload,ack})};
const playing=version=>({...room(version),hostId:'p0',mySecret:{hand:[{rank:7}],legalPlays:[{rank:7,count:1,jesterCount:0}]},dalmuti:{...room(version).dalmuti,currentTurnPlayerId:'p0',playPhase:'TURN_INPUT',config:{roundCount:3,turnTimeoutSeconds:0}}});
let commandRoom=playing(1);
const Game=loadComponent(process.env.DAL_GAME_SOURCE||'src/games/dalmuti/DalmutiGame.jsx',commandRuntime.hooks,{
 'framer-motion':{AnimatePresence:'fragment',motion:{div:'div',article:'article',button:'button',aside:'aside'},useReducedMotion:()=>false},
 '../../shared/RoomChat':{RoomChat:'chat'},'../../shared/useDialogFocus':{useDialogFocus:()=>({current:null})},
 '../love-letter/ui/GameMenuDrawer':{RoomVoiceControls:'voice'},'../love-letter/ui/GameHud':{GameHud:'hud'},
 '../../../packages/dalmuti-core/src/index.js':{DALMUTI_RANKS:{7:'재봉사'}},
 './useDalmutiPresentation.js':{useDalmutiPresentation:()=>({visualRoom:commandRoom,busy:false,finish(){},requestSync(){}})},
 './DalmutiMotionLayer.jsx':{DalmutiMotionLayer:'motion',DalmutiTableCard:'card'},'./DalmutiResults.jsx':{DalmutiResults:'results'},
 './presentationState.js':presentation,'./actionNarrative.js':{dalmutiActionNarrative:()=>null},
}).default;
let tree;const renderGame=()=>tree=commandRuntime.render(()=>Game({roomState:commandRoom,currentUser:{id:'p0'},socket:commandSocket}));
const submit=()=>{all(tree).find(n=>n.props?.title===undefined&&n.props?.['aria-pressed']===false&&n.props.onClick)?.props.onClick();renderGame();all(tree).find(n=>n.props.children==='중앙에 내기').props.onClick();renderGame();};
try{
 renderGame();submit();assert.equal(acks.length,1);
 commandRoom=playing(2);renderGame();renderGame();submit();assert.equal(acks.length,2);
 acks[0].ack({success:false,error:'late previous failure'});renderGame();
 assert.equal(all(tree).find(n=>n.props.children==='중앙에 내기').props.disabled,true,'late ACK cannot unlock a newer pending command');
 assert.ok(!all(tree).some(n=>n.props.children==='late previous failure'),'late error must not replace current command feedback');
 commandEvents.get('disconnect')();renderGame();
 console.log('PASS late ACK cannot unlock or overwrite a newer command');
}finally{commandRuntime.cleanup();}

const motionRuntime=hookRuntime();let now=0,observer,finished=0;
const geometryEvents=new Map();
globalThis.window={performance:{now:()=>now},requestAnimationFrame:fn=>{fn();return 1;},cancelAnimationFrame(){},addEventListener:(name,fn)=>geometryEvents.set(name,fn),removeEventListener:name=>geometryEvents.delete(name)};
window.ResizeObserver=class{constructor(fn){this.notify=fn;observer=this;}observe(){}disconnect(){this.disconnected=true;}};
let width=1000,height=800;
const surfaceListeners=new Map();
const rect=(x,y,w=40,h=60)=>({left:x,top:y,width:w,height:h});
const surface={get clientWidth(){return width;},get clientHeight(){return height;},getBoundingClientRect:()=>rect(0,0,width,height),addEventListener:(name,fn)=>surfaceListeners.set(name,fn),removeEventListener:name=>surfaceListeners.delete(name)};
const surfaceRef={current:surface},anchors={current:new Map([['player:p0',{getBoundingClientRect:()=>rect(20,height-80)}],['pile',{getBoundingClientRect:()=>rect(width/2-20,height/2-30)}]])};
const Motion=loadComponent(process.env.DAL_MOTION_SOURCE||'src/games/dalmuti/DalmutiMotionLayer.jsx',motionRuntime.hooks,{
 'framer-motion':{motion:{div:'div'}},'./presentationState.js':presentation,
 '../../../packages/dalmuti-core/src/index.js':{DALMUTI_RANKS:{7:'재봉사'}},
 '../../../packages/protocol/src/dalmutiPresentation.js':{dalmutiPresentationMs:()=>1400},
}).DalmutiMotionLayer;
const active={eventId:'flight',generation:1,event:{type:'SET_PLAYED',actorId:'p0',rank:7,count:1}},pileSets=[];
const renderMotion=()=>motionRuntime.render(()=>Motion({active,anchors,surfaceRef,myId:'p0',finish:()=>finished++,reduced:false,pileSets}));
try{
 renderMotion();let tree=renderMotion();
 const flight=()=>all(tree).find(n=>n.props.animate?.x!==undefined);
 const beat=all(tree).find(n=>n.props.onAnimationComplete);
 assert.equal(flight().props.animate.x,500);
 now=200;width=400;height=600;geometryEvents.get('resize')?.();observer?.notify();tree=renderMotion();
 assert.equal(flight().props.animate.x,200,'resize retargets to current pile geometry');
 assert.ok(flight().props.transition.duration<=0.22,'resize cannot restart the full flight duration');
 assert.equal(all(tree).find(n=>n.props.onAnimationComplete).key,beat.key,'geometry keeps completion clock identity');
 assert.equal(finished,0,'measurement cannot complete presentation');
 now=600;width=320;geometryEvents.get('resize')?.();tree=renderMotion();
 assert.equal(flight().props.transition.duration,0,'late layout correction cannot outlive reading beat');
 const reducedTree=motionRuntime.render(()=>Motion({active,anchors,surfaceRef,myId:'p0',finish:()=>finished++,reduced:true,pileSets}));
 assert.equal(all(reducedTree).some(n=>n.props.animate?.x!==undefined),false,'software reduced-motion path removes positional flights');
 assert.equal(all(reducedTree).find(n=>n.props.onAnimationComplete).props.transition.duration,1.4,'reduced motion preserves protocol reading completion');
 surfaceRef.current={...surface,removeEventListener(){}};
 motionRuntime.cleanup();
 assert.equal(surfaceListeners.size,0,'cleanup removes listener from original surface after ref replacement');
 console.log('PASS geometry retargets within original travel time and preserves completion clock; reduced software branch; replaced surface cleanup');
}finally{motionRuntime.cleanup();if(observer)assert.equal(observer.disconnected,true);delete globalThis.window;}

function resultHarness(final=false){
 const runtime=hookRuntime(),departures=[];
 const Results=loadComponent(process.env.DAL_RESULT_SOURCE||'src/games/dalmuti/DalmutiResults.jsx',runtime.hooks,{'../../shared/GameSurface':{GameAction:'button',ResultDialog:'result'}}).DalmutiResults;
 const players=Array.from({length:8},(_,i)=>({id:`p${i}`,nickname:`긴 이름의 플레이어 ${i}`,role:i?'농노':'달무티',score:i<2?10:8-i}));
 const game={players,roundNumber:2,matchState:final?'GAME_OVER':'ROUND_END',outcome:{finishOrder:players.map(p=>p.id),winnerIds:['p0','p1']}};
 let tree,presenting=false;
 const render=()=>tree=runtime.render(()=>Results({game,presenting,isHost:!final,locked:true,submitting:false,connectionNotice:'게임 일시정지',onLeave:payload=>departures.push(payload)}));
 const dialog=()=>all(tree).find(n=>n.type==='result');
 const action=text=>all(dialog().props.actions).find(n=>n.props.children===text);
 return{render,dialog,action,departures,game,runtime,setPresenting(value){presenting=value;},get tree(){return tree;}};
}
const results=resultHarness();
try{
 results.setPresenting(true);results.render();assert.equal(results.dialog().props.open,false,'terminal consequence completes before native result opens');
 results.setPresenting(false);results.render();assert.equal(results.dialog().props.open,true);assert.equal(results.action('바로 다음 라운드').props.disabled,true);
 assert.ok(all(results.dialog().props.actions).some(n=>n.props.role==='status'&&n.props.children==='게임 일시정지'));
 assert.equal(all(results.dialog()).filter(n=>n.type==='li').length,8);
 const firstRole=all(results.dialog()).find(n=>n.type==='span');
 assert.equal(React.Children.toArray(firstRole.props.children).join(''),'이번 라운드 · 달무티','finish rank must not imply previous role is next role');
 results.action('살롱 로비로').props.onClick();results.render();
 assert.equal(results.dialog().props.title,'게임을 나갈까요?');assert.equal(results.departures.length,0);
 results.tree.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});results.render();
 assert.equal(results.dialog().props.title,'2라운드 결과');
 results.action('살롱 로비로').props.onClick();results.render();
 results.game.matchState='PLAYING';results.render();assert.equal(results.dialog().props.open,true,'auto advance cannot hide an active leave decision');
 const confirm=results.action('기권하고 나가기');confirm.props.onClick();confirm.props.onClick();results.render();
 assert.deepEqual(results.departures,[{immediate:true}],'explicit confirmation delegates existing App forfeit once');
 console.log('PASS native result pause notice, eight standings, cancel and guarded forfeit');
}finally{results.runtime.cleanup();}
const final=resultHarness(true);
try{
 final.render();assert.ok(all(final.dialog().props.actions).some(n=>n.props.role==='status'&&String(n.props.children).includes('방장이 새 매치')));
 const ranks=all(final.dialog()).filter(n=>n.type==='b').map(n=>React.Children.toArray(n.props.children).join(''));
 assert.deepEqual(ranks.slice(0,2),['1위','1위'],'tied leaders retain competition rank');
 final.action('살롱 로비로').props.onClick();assert.deepEqual(final.departures,[{immediate:true}]);
 console.log('PASS match ties/nonhost explanation and immediate final leave');
}finally{final.runtime.cleanup();}
