import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import React from 'react';

const require = createRequire(import.meta.url);
const styledModule = require('styled-components');
let active;
const react = { ...React,
  useState(initial) { const i=active.cursor++, h=active; if(!(i in h.slots))h.slots[i]=typeof initial==='function'?initial():initial; return [h.slots[i],value=>{const next=typeof value==='function'?value(h.slots[i]):value;if(!Object.is(next,h.slots[i])){h.slots[i]=next;h.changed=true;}}]; },
  useRef(initial) { const i=active.cursor++; return active.slots[i]??(active.slots[i]={current:initial}); },
  useMemo(fn,deps) {const i=active.cursor++,old=active.slots[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j])))active.slots[i]={deps,value:fn()};return active.slots[i].value;},
  useCallback(fn,deps) { return react.useMemo(()=>fn,deps); },
  useEffect(fn,deps) { const i=active.cursor++,h=active,old=h.slots[i];if(!old||!deps||deps.some((d,j)=>!Object.is(d,old[j]))){h.slots[i]=deps;h.effects.push(()=>{h.cleanups[i]?.();h.cleanups[i]=fn();});} },
};
react.useLayoutEffect=react.useEffect;
const frames=new Map(), timers=new Map(); let timerId=0;
globalThis.requestAnimationFrame=fn=>{frames.set(++timerId,fn);return timerId;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
globalThis.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};
globalThis.clearTimeout=id=>timers.delete(id);
globalThis.window={ResizeObserver:class {observe(){} disconnect(){}}};
const code=buildSync({entryPoints:[process.env.NIMMT_TEST_COMPONENT||'src/games/six-nimmt/SixNimmtGame.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'}).outputFiles[0].text;
const module={exports:{}};
new Function('require','module','exports',code)(name=>name==='react'?react:name==='styled-components'?Object.assign(styledModule.default,styledModule):name==='framer-motion'?{...require(name),useReducedMotion:()=>false}:require(name),module,module.exports);
function harness(Component) {const h={slots:[],effects:[],cleanups:[],cursor:0,changed:false};return props=>{let tree;for(let n=0;n<12;n++){active=h;h.cursor=0;h.changed=false;tree=Component(props);while(h.effects.length)h.effects.shift()();if(!h.changed)return tree;}throw Error('Render failed to settle');};}
function all(tree) {return tree&&typeof tree==='object'?[tree,...React.Children.toArray(tree.props?.children).flatMap(all)]:[];}
const named=(tree,name)=>all(tree).find(n=>n.type?.name===name);
const snapshot={code:'QA',hostId:'me',serverTime:100000,turnExpiresAt:130000,turnTimeLimit:30,game:{stateVersion:1,selectionVersion:1,matchState:'PLAYING',playPhase:'SELECTING',roundNumber:1,turnNumber:1,config:{deckSize:24},players:[{id:'me',nickname:'Me',score:0,roundScore:0,handCount:10},{id:'other',nickname:'Other',score:0,roundScore:0,handCount:10}],rows:[[1],[5],[10],[11]],queue:[]},mySecret:{hand:[6,12],legalActions:[{type:'SELECT_CARD',card:6}]},presentation:{id:null,pending:false,events:[]}};
const props={roomState:snapshot,currentUser:{id:'me'},socket:{connected:true,timeout:()=>({emit(){}}),on(){},off(){}}};
const checks=[];
function check(name,fn){try{fn();checks.push({name,passed:true});console.log('PASS '+name);}catch(error){checks.push({name,passed:false,error:error.message});console.error('FAIL '+name+': '+error.message);}}
const render=harness(module.exports.default);
let tree=render(props), surface=named(tree,'Surface');
check('ordinary accepted snapshots preserve Surface key and type',()=>{const next=render({...props,roomState:{...snapshot,game:{...snapshot.game,stateVersion:2}}});const updated=named(next,'Surface');assert.equal(updated.type,surface.type);assert.equal(updated.key,surface.key);});
check('concealed commitment never passes card identity to its card component',()=>{const view=harness(surface.type);const table=view({...surface.props,game:{...snapshot.game,players:snapshot.game.players.map(p=>({...p,selected:true}))},secret:{selectedCard:6}});const backs=all(table).filter(n=>n.props?.back);assert.equal(backs.length,2);for(const back of backs){assert.equal(back.props.card,undefined);const face=harness(back.type)(back.props);assert.equal(face.props.layoutId,undefined);assert.ok(!JSON.stringify(face.props.children).includes('"6"'));}});
check('new event resets travel, stale completion ignored, duplicate completion acknowledged once',()=>{const a={id:'A',pending:true,events:[{type:'CARD_PLACED',rowIndex:0,card:6,playerId:'me'}]};const b={id:'B',pending:true,events:[{type:'CARD_PLACED',rowIndex:0,card:7,playerId:'other'}]};const calls=[];const view=harness(surface.type);const game={...snapshot.game,rows:[[1,6],[5],[10],[11]]};const base={...surface.props,game,presentation:a,onComplete:id=>calls.push(id)};let out=view(base);assert.ok(all(out).some(n=>n.props?.card===6));for(let i=0;i<2;i++){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}out=view(base);const first=all(out).find(n=>n.props?.card===6&&n.props.onComplete)?.props.onComplete;assert.ok(first);first();out=view(base);assert.deepEqual(calls,['A']);const next={...base,game:{...game,rows:[[1,6,7],[5],[10],[11]]},presentation:b};out=view(next);const queue=all(out).find(n=>n.props?.['aria-label']==='작은 숫자부터 공개 카드 해결');assert.ok(all(queue).some(n=>n.props?.card===7),'new event starts in queue');first();assert.deepEqual(calls,['A'],'stale event cannot finish B');for(let i=0;i<2;i++){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}out=view(next);const second=all(out).find(n=>n.props?.card===7&&n.props.onComplete)?.props.onComplete;assert.ok(second);second();second();view({...next,presentation:structuredClone(b)});assert.deepEqual(calls,['A','B']);});
check('deadline is a server-derived component with card and row consequences',()=>{const clock=all(tree).find(n=>n.type?.name==='NimmtDeadline');assert.ok(clock,'timed room must expose its deadline');});
check('interrupted unfinished event cannot acknowledge after replacement',()=>{
  const calls=[],view=harness(surface.type);
  const first={...surface.props,game:{...snapshot.game,rows:[[1,6],[5],[10],[11]]},presentation:{id:'unfinished-A',pending:true,events:[{type:'CARD_PLACED',rowIndex:0,card:6,playerId:'me'}]},onComplete:id=>calls.push(id)};
  view(first);for(let i=0;i<2;i++){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}
  const out=view(first),stale=all(out).find(n=>n.props?.card===6&&n.props.onComplete)?.props.onComplete;
  assert.ok(stale);
  view({...first,presentation:{id:'replacement-B',pending:true,events:[{type:'CARD_PLACED',rowIndex:0,card:7,playerId:'me'}]},game:{...first.game,rows:[[1,6,7],[5],[10],[11]]}});
  stale();assert.deepEqual(calls,[],'A completion must not ACK after B replaces it');
});
check('deadline handles expiry, paused, reconnecting, unlimited and pending without client commands',()=>{
  const compiled=buildSync({entryPoints:['src/games/six-nimmt/NimmtDeadline.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'}).outputFiles[0].text;
  const clock={exports:{}};new Function('require','module','exports',compiled)(require,clock,clock.exports);
  const describe=clock.exports.deadlineText;
  assert.match(describe(snapshot,100000,true),/카드 선택 0:30.*서버가 카드를 자동 선택/);
  assert.match(describe(snapshot,129001,true),/0:01/);
  assert.match(describe(snapshot,130000,true),/^시간 종료/);
  assert.match(describe(snapshot,999999,true),/^시간 종료/);
  const row={...snapshot,game:{...snapshot.game,playPhase:'CHOOSING_ROW'}};
  assert.match(describe(row,100000,true),/줄 선택 0:30.*서버가 줄을 자동 선택/);
  assert.match(describe({...snapshot,isPaused:true},999999,true),/일시정지/);
  assert.match(describe(snapshot,100000,false),/재접속 중/);
  assert.equal(describe({...snapshot,turnTimeLimit:0},100000,true),'제한시간 없음');
  assert.match(describe({...snapshot,presentation:{pending:true}},100000,true),/제한시간 대기/);
  assert.match(describe({...snapshot,turnExpiresAt:0},100000,true),/동기화/);
  assert.match(describe(snapshot,NaN,true),/동기화/);
  assert.equal(describe({...snapshot,game:{...snapshot.game,matchState:'GAME_OVER'}},100000,true),null);
});
check('malformed row event settles through guarded completion without indexing outside rows',()=>{
  const calls=[],view=harness(surface.type);
  const out=view({...surface.props,presentation:{id:'invalid-row',pending:true,events:[{type:'ROW_TAKEN',rowIndex:99,card:3,playerId:'me'}]},onComplete:id=>calls.push(id)});
  const notice=all(out).find(n=>n.props?.onAnimationComplete);
  assert.ok(notice);notice.props.onAnimationComplete();notice.props.onAnimationComplete();
  assert.deepEqual(calls,['invalid-row']);
});
check('penalties use five distinct colors, exact glyph counts and number-free back',()=>{
  const compiled=buildSync({entryPoints:['src/games/six-nimmt/NimmtCard.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'}).outputFiles[0].text;
  const cards={exports:{}};new Function('require','module','exports',compiled)(name=>name==='styled-components'?Object.assign(styledModule.default,styledModule):require(name),cards,cards.exports);
  const colors=[];
  for(const [card,penalty] of [[1,1],[5,2],[10,3],[11,5],[55,7]]){
    const face=cards.exports.default({card});
    assert.equal(all(face).filter(n=>n.type==='path').length,penalty);
    assert.match(face.props['aria-label'],new RegExp(`소머리 ${penalty}개`));
    colors.push(face.props.style['--penalty-color']);
  }
  assert.equal(new Set(colors).size,5);
  const six=cards.exports.default({card:6}),back=cards.exports.default({back:true});
  assert.equal(all(six).find(n=>n.type==='strong').props.children,6);
  assert.equal(all(back).filter(n=>n.type==='strong').length,0);
  assert.equal(back.props.layoutId,undefined);
});
check('clock uses server anchor plus monotonic elapsed time and resynchronizes after pause',()=>{
  const compiled=buildSync({entryPoints:['src/games/six-nimmt/NimmtDeadline.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'}).outputFiles[0].text;
  const clock={exports:{}};new Function('require','module','exports',compiled)(name=>name==='react'?react:require(name),clock,clock.exports);
  const savedPerformance=window.performance,savedNow=Date.now,savedInterval=globalThis.setInterval,savedClear=globalThis.clearInterval;
  let monotonic=1000,tick;
  window.performance={now:()=>monotonic};
  globalThis.setInterval=fn=>{tick=fn;return 1;};globalThis.clearInterval=()=>{tick=null;};
  try{
    const view=harness(clock.exports.default);let out=view({room:snapshot,connected:true});assert.match(out.props.children,/0:30/);
    Date.now=()=>999999999999;monotonic+=5000;tick();out=view({room:snapshot,connected:true});assert.match(out.props.children,/0:25/,'wall-clock skew cannot expire the server timer');
    out=view({room:{...snapshot,isPaused:true},connected:true});assert.match(out.props.children,/일시정지/);assert.equal(tick,null,'paused clock stops its interval');
    monotonic+=60000;out=view({room:{...snapshot,serverTime:200000,turnExpiresAt:210000},connected:true});assert.match(out.props.children,/0:10/,'resume uses refreshed server deadline');
  }finally{window.performance=savedPerformance;Date.now=savedNow;globalThis.setInterval=savedInterval;globalThis.clearInterval=savedClear;}
});
mkdirSync('.omo/evidence/ui-ux',{recursive:true});
writeFileSync('.omo/evidence/ui-ux/task-7-regression.json',JSON.stringify({invocation:'node tests/six_nimmt_presentation.test.js',checks},null,2));
if(checks.some(c=>!c.passed))process.exitCode=1;
