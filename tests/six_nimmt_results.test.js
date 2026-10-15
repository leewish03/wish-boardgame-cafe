import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import React from 'react';

const require=createRequire(import.meta.url),styledModule=require('styled-components');
let active;
const react={...React,
  useState(initial){const i=active.cursor++,h=active;if(!(i in h.slots))h.slots[i]=typeof initial==='function'?initial():initial;return[h.slots[i],value=>{const next=typeof value==='function'?value(h.slots[i]):value;if(!Object.is(next,h.slots[i])){h.slots[i]=next;h.changed=true;}}];},
  useRef(initial){const i=active.cursor++;return active.slots[i]??(active.slots[i]={current:initial});},
  useMemo(fn,deps){const i=active.cursor++,old=active.slots[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j])))active.slots[i]={deps,value:fn()};return active.slots[i].value;},
  useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
  useEffect(fn,deps){const i=active.cursor++,h=active,old=h.slots[i];if(!old||!deps||deps.some((d,j)=>!Object.is(d,old[j]))){h.slots[i]=deps;h.effects.push(()=>{h.cleanups[i]?.();h.cleanups[i]=fn();});}},
};
react.useLayoutEffect=react.useEffect;
function harness(Component){const h={slots:[],effects:[],cleanups:[],cursor:0,changed:false};return props=>{for(let n=0;n<12;n++){active=h;h.cursor=0;h.changed=false;const tree=Component(props);while(h.effects.length)h.effects.shift()();if(!h.changed)return tree;}throw Error('Render did not settle');};}
const code=buildSync({entryPoints:['src/games/six-nimmt/SixNimmtGame.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'}).outputFiles[0].text;
const module={exports:{}};
new Function('require','module','exports',code)(name=>name==='react'?react:name==='styled-components'?Object.assign(styledModule.default,styledModule):name==='framer-motion'?{...require(name),useReducedMotion:()=>false}:require(name),module,module.exports);
function all(tree){return tree&&typeof tree==='object'?[tree,...React.Children.toArray(tree.props?.children).flatMap(all)]:[];}
const named=(tree,name)=>all(tree).find(n=>n.type?.name===name);
const text=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):React.Children.toArray(tree?.props?.children).map(text).join('');
const room={code:'END',hostId:'p0',game:{stateVersion:4,selectionVersion:4,matchState:'GAME_OVER',playPhase:'RESOLVING',roundNumber:3,turnNumber:10,config:{deckSize:24},rows:[[1],[20],[30],[40]],queue:[],players:[{id:'p0',nickname:'First',score:71,roundScore:11,handCount:0},{id:'p1',nickname:'Winner',score:20,roundScore:3,handCount:0}],outcome:{winnerIds:['p1']}},mySecret:{hand:[],legalActions:[]},presentation:{pending:false,id:null,events:[]}};
function setup(snapshot=room,user='p0'){const calls=[],socket={connected:true,on(){},off(){},timeout(){return{emit(event,payload,callback){calls.push({event,payload,callback});}};}};const props={roomState:snapshot,currentUser:{id:user},socket,onLeave:()=>calls.push({event:'leave'})};const render=harness(module.exports.default);return{calls,props,render};}
const checks=[];
function check(name,fn){try{fn();checks.push({name,passed:true});console.log('PASS '+name);}catch(error){checks.push({name,passed:false,error:error.message});console.error('FAIL '+name+': '+error.message);}}
check('final public Surface persists and standings wait for collection settlement',()=>{
  const s=setup(),pending={...room,presentation:{id:'final',pending:true,events:[{type:'ROW_TAKEN',playerId:'p0',rowIndex:0,card:1,cards:[10,11,12,13,14],points:11}]}};
  let tree=s.render({...s.props,roomState:pending});const before=named(tree,'Surface');assert.ok(before);
  assert.ok(!named(tree,'NimmtResults')?.props.open,'pending collection cannot open standings');
  tree=s.render(s.props);assert.ok(named(tree,'NimmtResults')?.props.open,'settled terminal state opens shared adapter');
  assert.equal(named(tree,'Surface')?.key,before.key,'public table retains identity behind result');
});
check('collected row face is not reused as the newly placed card',()=>{
  const s=setup(),surface=named(s.render(s.props),'Surface'),view=harness(surface.type);
  const old=view({...surface.props,game:{...room.game,rows:[[10,11,12,13,14],[20],[30],[40]]}});
  const rows=tree=>all(tree).find(n=>n.props?.['aria-label']==='네 개의 카드 줄');
  const oldFace=all(rows(old)).find(n=>n.props?.card===10);
  const next=view(surface.props),newFace=all(rows(next)).find(n=>n.props?.card===1);
  assert.ok(oldFace&&newFace);assert.notEqual(oldFace.key,newFace.key,'React must not reuse collected10 projection for placed1');
});
check('resize reveals actor before travelling anchors measure the viewport',()=>{
  const s=setup(),surface=named(s.render(s.props),'Surface');
  const priorWindow=globalThis.window,listeners=new Map();let observer,disconnected=false,scrollTop=0;
  const seats={clientWidth:100,clientHeight:130,getBoundingClientRect:()=>({left:0,top:120}),scrollBy({top}){scrollTop+=top;}};
  const actor={getBoundingClientRect:()=>({left:0,right:85,top:680-scrollTop,bottom:786-scrollTop})};
  globalThis.window={ResizeObserver:class{constructor(fn){observer=fn;}observe(node){assert.equal(node,seats);}disconnect(){disconnected=true;}},addEventListener(type,fn,capture){listeners.set(type,{fn,capture});},removeEventListener(type,fn,capture){assert.deepEqual(listeners.get(type),{fn,capture});listeners.delete(type);}};
  const h={slots:[{current:seats},{current:actor}],effects:[],cleanups:[],cursor:0,changed:false};
  try{active=h;surface.type(surface.props);while(h.effects.length)h.effects.shift()();assert.equal(scrollTop,536);scrollTop=0;
    const resize=listeners.get('resize');assert.equal(resize?.capture,true,'actor visibility must precede bubble-phase anchor measurements');resize.fn();
    assert.equal(actor.getBoundingClientRect().bottom,250,'travel measurement sees visible destination immediately');observer();assert.equal(scrollTop,536,'observer followup must not scroll twice');
    h.cleanups.filter(Boolean).forEach(fn=>fn());assert.equal(listeners.size,0);assert.equal(disconnected,true);
  }finally{globalThis.window=priorWindow;}
});
check('match host rematch locks through ACK until new authoritative snapshot',()=>{
  const s=setup();let tree=s.render(s.props),result=named(tree,'NimmtResults');assert.ok(result);
  result.props.onAdvance();result.props.onAdvance();
  let commands=s.calls.filter(c=>c.event==='board:start');assert.equal(commands.length,1);
  assert.equal(commands[0].payload.roomCode,'END');assert.equal(commands[0].payload.userId,'p0');
  commands[0].callback(null,{success:true});tree=s.render(s.props);assert.equal(named(tree,'NimmtResults').props.pending,true);
  named(tree,'NimmtResults').props.onAdvance();assert.equal(s.calls.filter(c=>c.event==='board:start').length,1);
  tree=s.render({...s.props,roomState:{...room,game:{...room.game,stateVersion:5,matchState:'PLAYING'}}});assert.ok(!named(tree,'NimmtResults')?.props.open);
});
check('round advance carries exact version and failed ACK restores retry',()=>{
  const snapshot={...room,game:{...room.game,matchState:'ROUND_END',outcome:null}},s=setup(snapshot);
  let tree=s.render(s.props);named(tree,'NimmtResults').props.onAdvance();
  const command=s.calls.find(c=>c.event==='board:command');assert.deepEqual(command.payload.command,{type:'ADVANCE_ROUND'});assert.equal(command.payload.expectedVersion,4);
  command.callback(null,{success:false,error:'다시 시도'});tree=s.render(s.props);const result=named(tree,'NimmtResults');assert.equal(result.props.pending,false);assert.equal(result.props.error,'다시 시도');
  result.props.onAdvance();assert.equal(s.calls.filter(c=>c.event==='board:command').length,2);
});
check('fresh connected terminal snapshot clears stale connection error',()=>{
  const s=setup();let tree=s.render(s.props);named(tree,'NimmtResults').props.onAdvance();
  s.calls.find(c=>c.event==='board:start').callback(true);tree=s.render(s.props);assert.ok(named(tree,'NimmtResults').props.error);
  tree=s.render({...s.props,roomState:{...room,game:{...room.game,stateVersion:5}}});assert.equal(named(tree,'NimmtResults').props.error,'');
});
check('round leave exclusively opens confirmation and cancel restores result',()=>{
  const s=setup({...room,game:{...room.game,matchState:'ROUND_END'}});let tree=s.render(s.props);named(tree,'NimmtResults').props.onLeave();tree=s.render(s.props);
  assert.equal(named(tree,'NimmtResults').props.open,false);assert.equal(s.calls.filter(c=>c.event==='leave').length,0);
  const cancel=all(tree).find(n=>text(n)==='취소'&&n.props?.onClick);assert.ok(cancel);cancel.props.onClick();tree=s.render(s.props);assert.equal(named(tree,'NimmtResults').props.open,true);
  named(tree,'NimmtResults').props.onLeave();tree=s.render(s.props);all(tree).find(n=>text(n)==='기권하고 나가기'&&n.props?.onClick).props.onClick();assert.equal(s.calls.filter(c=>c.event==='leave').length,1);
});
check('match leave is immediate; nonhost and disconnected views cannot advance',()=>{
  const s=setup(room,'p1');let tree=s.render(s.props),result=named(tree,'NimmtResults');assert.ok(result);assert.equal(result.props.isHost,false);result.props.onAdvance();assert.equal(s.calls.filter(c=>c.event==='board:start').length,0);result.props.onLeave();assert.equal(s.calls.filter(c=>c.event==='leave').length,1);
  s.props.socket.connected=false;tree=s.render({...s.props,currentUser:{id:'p0'}});result=named(tree,'NimmtResults');assert.equal(result.props.locked,true);result.props.onAdvance();assert.equal(s.calls.filter(c=>c.event==='board:start').length,0);
});
check('travelling public face escapes clipping using a stable anchor and cleans up observers',()=>{
  const travelCode=buildSync({entryPoints:['src/games/six-nimmt/NimmtTravelCard.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'}).outputFiles[0].text;
  const travel={exports:{}},runs=[];
  const motion={...require('framer-motion'),useMotionValue(initial){const ref=react.useRef({value:initial,set(value){this.value=value;},get(){return this.value;}});return ref.current;},animate(_from,_to,options){const run={options,stopped:false,stop(){this.stopped=true;}};runs.push(run);return run;}};
  new Function('require','module','exports',travelCode)(name=>name==='react'?react:name==='framer-motion'?motion:name==='styled-components'?Object.assign(styledModule.default,styledModule):require(name),travel,travel.exports);
  const priorWindow=globalThis.window,listeners=new Map();let observer,disconnected=false,reads=0,completed=0;
  let rect={left:300,top:120,width:52,height:76};
  const source={left:600,top:350,width:52,height:76},anchor={getBoundingClientRect(){reads++;return rect;}};
  globalThis.window={performance:{now:()=>0},ResizeObserver:class{constructor(callback){observer=callback;}observe(node){assert.equal(node,anchor);}disconnect(){disconnected=true;}},addEventListener(type,fn,capture){listeners.set(type,{fn,capture});},removeEventListener(type,fn,capture){assert.deepEqual(listeners.get(type),{fn,capture});listeners.delete(type);}};
  const h={slots:[{current:anchor}],effects:[],cleanups:[],cursor:0,changed:false};
  const render=()=>{active=h;h.cursor=0;const tree=travel.exports.default({card:55,source,onComplete:()=>completed++,style:{scale:'0.24',originX:1,originY:1}});while(h.effects.length)h.effects.shift()();return tree;};
  try{
    render();let tree=render();assert.equal(tree.type,'span');
    let face=React.Children.only(tree.props.children);assert.equal(face.props.style.position,'fixed');assert.equal(face.props.style.x.get(),600);assert.equal(face.props.card,55);assert.equal(all(tree).filter(n=>n.props?.card===55).length,1);
    assert.equal(tree.props.style.scale,undefined);assert.equal(face.props.style.originX,0);assert.equal(face.props.style.originY,0);assert.equal(face.props.layout,false,'explicit flight cannot join resize-completing projection tree');
    assert.equal(listeners.get('scroll').capture,true);assert.equal(reads,1);runs[0].options.onUpdate(.5);assert.equal(reads,1,'animation frames never read DOM geometry');
    const current=face.props.style.x.get();rect={left:24,top:80,width:44,height:52};listeners.get('resize').fn();assert.equal(face.props.style.x.get(),current,'resize retarget preserves current position');
    rect={...rect,top:60};listeners.get('scroll').fn();observer();assert.equal(runs.length,3,'unchanged observer target does not restart');
    runs.at(-1).options.onUpdate(1);assert.equal(face.props.style.x.get(),24+44*.76);assert.equal(face.props.style.y.get(),60+52*.76);assert.equal(face.props.style.scaleX.get(),44*.24/52);
    const painted=face.type(face.props);assert.ok(painted.props.style['--penalty-color']);assert.equal(painted.props.layoutId,undefined);
    h.cleanups.filter(Boolean).forEach(fn=>fn());assert.equal(disconnected,true);assert.equal(listeners.size,0);assert.ok(runs.at(-1).stopped);runs.at(-1).options.onComplete();assert.equal(completed,0,'unmounted flight cannot finish an event');
  }finally{globalThis.window=priorWindow;}
});
check('collection waits for every travelling card and rejects stale or duplicate completion',()=>{
  const s=setup(),surface=named(s.render(s.props),'Surface'),view=harness(surface.type),calls=[];
  const savedRaf=globalThis.requestAnimationFrame,savedCancel=globalThis.cancelAnimationFrame,frames=[];
  globalThis.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};globalThis.cancelAnimationFrame=()=>{};
  const event={type:'ROW_TAKEN',playerId:'p0',rowIndex:0,card:1,cards:[10,11],points:8};
  const props={...surface.props,presentation:{id:'collect-A',pending:true,events:[event]},onComplete:id=>calls.push(id)};
  try{const before=view(props);for(const face of all(before).filter(n=>n.props?.faceRef))face.props.faceRef({getBoundingClientRect:()=>({left:face.props.card*10,top:100,width:52,height:76})});for(let i=0;i<2;i++)frames.splice(0).forEach(fn=>fn());let tree=view(props);
    const flights=all(tree).filter(n=>n.type?.name==='NimmtTravelCard');assert.equal(flights.length,3);
    assert.ok(flights.every(n=>typeof n.props.onComplete==='function'),'each collected and placed face participates in settlement');
    for(const face of flights)assert.deepEqual(face.props.source,{left:face.props.card*10,top:100,width:52,height:76},'flight starts at the measured public source, not destination');
    const placed=flights.find(n=>n.props.card===1),old=flights.filter(n=>n.props.card!==1);
    placed.props.onComplete();placed.props.onComplete();assert.deepEqual(calls,[],'placed card alone cannot finish collection');
    old[0].props.onComplete();assert.deepEqual(calls,[]);old[1].props.onComplete();old[1].props.onComplete();assert.deepEqual(calls,['collect-A']);
    const next={...props,presentation:{id:'collect-B',pending:true,events:[event]}};view(next);old[0].props.onComplete();assert.deepEqual(calls,['collect-A']);
  }finally{globalThis.requestAnimationFrame=savedRaf;globalThis.cancelAnimationFrame=savedCancel;}
});
check('explicit travel retargets current rectangle over remaining duration and ignores stopped completion',()=>{
  const compiled=buildSync({entryPoints:['src/games/six-nimmt/NimmtTravelCard.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'}).outputFiles[0].text;
  const loaded={exports:{}};new Function('require','module','exports',compiled)(name=>name==='styled-components'?Object.assign(styledModule.default,styledModule):require(name),loaded,loaded.exports);
  assert.equal(typeof loaded.exports.createNimmtFlight,'function','travel needs an explicit resize-safe lifecycle');
  let now=0,completed=0,current;const runs=[];
  const flight=loaded.exports.createNimmtFlight({from:{left:600,top:350,width:52,height:76},duration:380,now:()=>now,animate:(_from,_to,options)=>{const run={options,stopped:false,stop(){this.stopped=true;}};runs.push(run);return run;},onUpdate:box=>{current=box;},onComplete:()=>completed++});
  const target={left:1195.52,top:202.76,width:12.48,height:18.24};flight.retarget(target);runs[0].options.onUpdate(.25);const before={...current};now=100;
  const rotated={left:76.52,top:228.52,width:12.48,height:12.48};flight.retarget(rotated);assert.deepEqual(current,before,'resize must preserve current physical position');assert.equal(runs[0].stopped,true);assert.equal(runs[1].options.duration,.28);
  runs[0].options.onComplete();assert.equal(completed,0,'cancelled generation cannot complete');runs[1].options.onUpdate(.5);assert.equal(current.left,(before.left+rotated.left)/2);
  flight.retarget({...rotated});assert.equal(runs.length,2,'unchanged observer callback cannot restart flight');runs[1].options.onComplete();assert.deepEqual(current,rotated);assert.equal(completed,1);runs[1].options.onComplete();assert.equal(completed,1);
  const settledResize={...rotated,left:120,top:240};flight.retarget(settledResize);
  assert.deepEqual(current,settledResize,'completed member follows its anchor while sibling paths remain pending');
  assert.equal(runs.length,2,'completed member must not animate again');assert.equal(completed,1,'following the anchor cannot acknowledge twice');
  flight.dispose();flight.retarget(rotated);runs[1].options.onUpdate(.2);assert.deepEqual(current,settledResize);
});
check('every seat reserves a pile landing area with settled face bottom-right origin',()=>{
  const s=setup(),surface=named(s.render(s.props),'Surface'),view=harness(surface.type);
  const before=view(surface.props);
  const tree=view({...surface.props,presentation:{pending:false,events:[{type:'ROW_TAKEN',playerId:'p0',rowIndex:0,card:1,cards:[10,11],points:8}]}});
  const pile=all(tree).find(n=>n.props?.['aria-label']==='8 벌점 받음');assert.ok(pile);
  assert.equal(all(before).filter(n=>n.type===pile.type).length,room.game.players.length,'empty landing areas reserve space before collection');
  assert.equal(all(tree).filter(n=>n.type===pile.type).length,room.game.players.length,'collection must not add a seat layout slot');
  assert.match(pile.type.componentStyle.rules.join(''),/position:relative/,'landing area participates in seat flow below labels');
  const wrapper=React.Children.toArray(pile.props.children)[0];assert.equal(wrapper.props.style?.scale,undefined);
  const face=React.Children.only(wrapper.props.children);assert.equal(face.props.style.scale,'0.24');assert.equal(face.props.style.originX,1);assert.equal(face.props.style.originY,1);
});
check('adapter uses shared result with truthful tied ranks and separate round/total penalties',()=>{
  const s=setup();const node=named(s.render(s.props),'NimmtResults');assert.ok(node);
  const players=Array.from({length:10},(_,i)=>({id:`p${i}`,nickname:`아주 긴 참가자 이름 ${i}`,score:i<2?7:20+i,roundScore:i}));
  const tree=node.type({...node.props,game:{...room.game,players,outcome:{winnerIds:['p0','p1']}}});const dialog=named(tree,'ResultDialog');assert.ok(dialog);assert.equal(dialog.props.open,true);
  const rows=all(dialog.props.children).filter(n=>n.type==='li');assert.equal(rows.length,10);assert.match(text(rows[0]),/공동 1위/);assert.match(text(rows[1]),/공동 1위/);assert.match(text(rows[2]),/3위/);assert.match(text(rows[0]),/이번 판/);assert.match(text(rows[0]),/누적/);
  const guest=node.type({...node.props,isHost:false});assert.match(text(named(guest,'ResultDialog').props.actions),/방장/);assert.ok(!all(named(guest,'ResultDialog').props.actions).some(n=>n.props?.onClick===node.props.onAdvance));
});
mkdirSync('.omo/evidence/ui-ux',{recursive:true});writeFileSync('.omo/evidence/ui-ux/task-12-regression.json',JSON.stringify({invocation:'node tests/six_nimmt_results.test.js',checks},null,2));if(checks.some(c=>!c.passed))process.exitCode=1;
