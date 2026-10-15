import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { transformSync } from 'esbuild';
import React from 'react';
const require=createRequire(import.meta.url), styledModule=require('styled-components');
let active, timeline, spatialRegistry;
const react={...React,
 useState(initial){const i=active.cursor++,h=active;if(!(i in h.slots))h.slots[i]=typeof initial==='function'?initial():initial;return[h.slots[i],value=>{const next=typeof value==='function'?value(h.slots[i]):value;if(!Object.is(next,h.slots[i])){h.slots[i]=next;h.changed=true;}}];},
 useRef(initial){const i=active.cursor++;return active.slots[i]??(active.slots[i]={current:initial});},
 useMemo(fn,deps){const i=active.cursor++,old=active.slots[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j])))active.slots[i]={deps,value:fn()};return active.slots[i].value;},
 useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
 useEffect(fn,deps){const i=active.cursor++,h=active,old=h.slots[i];if(!old||!deps||deps.some((d,j)=>!Object.is(d,old[j]))){h.slots[i]=deps;h.effects.push(()=>{h.cleanups[i]?.();h.cleanups[i]=fn();});}},
};react.useLayoutEffect=react.useEffect;
const intervals=new Map();let timer=0;
globalThis.window={setInterval:fn=>{intervals.set(++timer,fn);return timer;},clearInterval:id=>intervals.delete(id)};
globalThis.clearInterval=window.clearInterval;
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
const cache=new Map();
const leaf=name=>{const fn=()=>null;Object.defineProperty(fn,'name',{value:name});return fn;};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const source=readFileSync(file,'utf8');const module={exports:{}};cache.set(file,module.exports);const code=transformSync(source,{loader:file.endsWith('tsx')?'tsx':'ts',format:'cjs'}).code;new Function('require','module','exports',code)(name=>{
 if(name==='react')return react;if(file.endsWith('SpatialMotionStage.tsx')&&name==='./TableAnchorRegistry')return{useTableAnchorRegistry:()=>spatialRegistry};if(name==='styled-components')return Object.assign(styledModule.default,styledModule);if(name==='framer-motion')return{...require(name),useReducedMotion:()=>false};
 if(name.endsWith('/sfx'))return{sfx:new Proxy({},{get:()=>()=>{}})};
 if(name.endsWith('/useGameSocket'))return{useGameSocket:()=>({gameState:null,myHand:[],isConnected:true,serverClockOffsetMs:0})};
 if(name.endsWith('/useActionTimeline')){const actual=load(path.resolve(path.dirname(file),name+'.ts'));return{...actual,useActionTimeline:()=>{timeline=actual.useActionTimeline();return timeline;}};}
 if(name.endsWith('/GameSurface'))return{ResultDialog:leaf('ResultDialog'),GameAction:leaf('GameAction')};
 if(file.endsWith('LoveLetterGame.tsx')&&(/\.\/[^/]+$/.test(name)||name.endsWith('/SpatialMotionStage')||name.endsWith('/TableAnchorRegistry')||name.endsWith('/PresentationStagePlane'))){const key=name.split('/').at(-1);if(key==='playerCopy')return load(path.resolve(path.dirname(file),name+'.ts'));if(key==='TableAnchorRegistry')return{TableAnchorProvider:leaf('TableAnchorProvider')};if(key==='PlayerZone')return{LocalPlayerZone:leaf('LocalPlayerZone')};return{[key]:leaf(key)};}
 if(name.startsWith('.')){const base=path.resolve(path.dirname(file),name);for(const extension of ['.ts','.tsx','.js','.jsx']){try{return load(base+extension);}catch(error){if(error.code!=='ENOENT')throw error;}}}
 return require(name);
 },module,module.exports);cache.set(file,module.exports);return module.exports;}
function harness(Component,onRender=()=>{}){const h={slots:[],effects:[],cleanups:[],cursor:0,changed:false};let lastTree,lastProps;const render=props=>{lastProps=props;for(let n=0;n<12;n++){active=h;h.cursor=0;h.changed=false;const tree=Component(props);onRender(tree);while(h.effects.length)h.effects.shift()();if(!h.changed)return lastTree=tree;}throw Error('Render did not settle');};render.flush=()=>h.changed?render(lastProps):lastTree;render.dispose=()=>h.cleanups.forEach(fn=>fn?.());return render;}
function all(tree){return tree&&typeof tree==='object'?[tree,...React.Children.toArray(tree.props?.children).flatMap(all)]:[];}
const named=(tree,name)=>all(tree).find(n=>n.type?.name===name);
const text=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):React.Children.toArray(tree?.props?.children).map(text).join('');
const checks=[];async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name);}catch(error){checks.push({name,passed:false,error:error.stack});console.error('FAIL '+name+': '+error.message);}}
const {RoundResultModal}=load('src/games/love-letter/ui/RoundResultModal.tsx');
const {MatchResultModal}=load('src/games/love-letter/ui/MatchResultModal.tsx');
const players=[{id:'me',nickname:'Me',tokens:4,isHost:true,cardCount:1,discardPile:[]},{id:'other',nickname:'Other',tokens:2,cardCount:1,discardPile:[]},{id:'third',nickname:'Third',tokens:2,cardCount:1,discardPile:[]}];
await check('host unlocks at canAdvanceAt even without an automatic advance deadline',()=>{
 const saved=Date.now;let now=1000;Date.now=()=>now;const view=harness(RoundResultModal);const props={isOpen:true,roundNumber:1,winnerName:'Me',localUserId:'me',isHost:true,onNextRound(){},players,canAdvanceAt:2000};
 try{let tree=view(props);let button=all(named(tree,'ResultDialog')?.props.actions??tree).find(n=>n.props?.onClick===props.onNextRound);assert.equal(button.props.disabled,true);now=2001;for(const tick of intervals.values())tick();tree=view.flush();button=all(named(tree,'ResultDialog')?.props.actions??tree).find(n=>n.props?.onClick===props.onNextRound);assert.equal(button.props.disabled,false);}finally{view.dispose();Date.now=saved;}
});
await check('equal public token totals have equal standing instead of array-order ranks',()=>{
 const view=harness(MatchResultModal);const tree=view({isOpen:true,championName:'Me',localUserId:'me',players,onReturnToLobby(){}});const dialog=named(tree,'ResultDialog');const visible=text(dialog?.props.children??tree);assert.match(visible,/Other/);assert.match(visible,/Third/);assert.equal((visible.match(/공동 2위/g)||[]).length,2,'Equal scores must share rank');view.dispose();
});
await check('public comparison cards stay with their score rows without duplicate winner names or unknown values',()=>{
 const view=harness(RoundResultModal);const tree=view({isOpen:true,roundNumber:1,winnerName:'Other',localUserId:'me',isHost:true,onNextRound(){},players,winnerIds:['other','third'],winnerCards:{other:{id:'public-card',value:8,name:'공주'}}});
 const body={props:{children:named(tree,'ResultDialog').props.children}};const visible=text(body);assert.equal((visible.match(/Other/g)||[]).length,1,'Winner name belongs in one score row');assert.doesNotMatch(visible,/\?/);const row=all(body).find(n=>n.props?.$winner&&text(n).includes('Other'));assert.match(text(row),/공개 비교 카드.*8/);view.dispose();
});
await check('round leave stays inside result, cancellation preserves table, confirmation emits once',()=>{
 const calls=[];const view=harness(RoundResultModal);const props={isOpen:true,roundNumber:1,winnerName:'Me',localUserId:'other',isHost:false,onNextRound(){},onLeave:()=>calls.push('leave'),players};let tree=view(props);let actions=named(tree,'ResultDialog')?.props.actions;const leave=all(actions).find(n=>n.props?.onClick&&text(n)==='살롱 로비로');assert.ok(leave);leave.props.onClick();tree=view(props);actions=named(tree,'ResultDialog').props.actions;assert.equal(calls.length,0);all(actions).find(n=>text(n)==='취소').props.onClick();tree=view(props);all(named(tree,'ResultDialog').props.actions).find(n=>n.props?.onClick&&text(n)==='살롱 로비로').props.onClick();tree=view(props);const confirm=all(named(tree,'ResultDialog').props.actions).find(n=>text(n)==='기권하고 나가기');confirm.props.onClick();confirm.props.onClick();assert.deepEqual(calls,['leave']);view.dispose();
});
await check('Escape cancels leave confirmation without leaving the match',()=>{
 const view=harness(RoundResultModal),props={isOpen:true,roundNumber:1,winnerName:'Me',localUserId:'other',isHost:false,onNextRound(){},onLeave(){throw Error('Must not leave');},players};
 let tree=view(props);all(named(tree,'ResultDialog').props.actions).find(n=>n.props?.onClick&&text(n)==='살롱 로비로').props.onClick();tree=view(props);
 let prevented=false;tree.props.onKeyDown({key:'Escape',preventDefault(){prevented=true;},stopPropagation(){}});tree=view(props);assert.equal(prevented,true);assert.doesNotMatch(text(named(tree,'ResultDialog').props.actions),/기권하고 나가기/);view.dispose();
});
await check('round progression clears an abandoned leave confirmation',()=>{
 const view=harness(RoundResultModal),props={isOpen:true,roundNumber:1,winnerName:'Me',localUserId:'other',isHost:false,onNextRound(){},onLeave(){},players};
 let tree=view(props);all(named(tree,'ResultDialog').props.actions).find(n=>n.props?.onClick&&text(n)==='살롱 로비로').props.onClick();tree=view(props);assert.match(text(named(tree,'ResultDialog').props.actions),/기권하고 나가기/);
 tree=view({...props,roundNumber:2});assert.doesNotMatch(text(named(tree,'ResultDialog').props.actions),/기권하고 나가기/);assert.match(text(named(tree,'ResultDialog').props.actions),/살롱 로비로/);view.dispose();
});
await check('match authority and insufficient-human outcomes retain permitted actions',()=>{
 for(const props of [{isHost:false},{isHost:true,reason:'INSUFFICIENT_HUMANS'},{isHost:true}]){
  const view=harness(MatchResultModal),tree=view({isOpen:true,championName:'Me',localUserId:'me',players,onPlayAgain(){},onReturnToLobby(){},...props}),dialog=named(tree,'ResultDialog');
  const actions=text(dialog.props.actions);assert.match(actions,/살롱 로비로/);assert.equal(actions.includes('같은 멤버로 새 매치'),props.isHost&&!props.reason);
  if(props.reason)assert.equal(text(dialog.props.children),'');view.dispose();
 }
});
await check('match leave emits once during repeated clicks and resets for a newly opened result',()=>{
 let leaves=0;const view=harness(MatchResultModal),props={isOpen:true,championName:'Me',localUserId:'me',players,isHost:true,onPlayAgain(){},onReturnToLobby(){leaves++;}};
 let tree=view(props);const leave=all(named(tree,'ResultDialog').props.actions).find(n=>n.props?.onClick&&text(n)==='살롱 로비로');leave.props.onClick();leave.props.onClick();assert.equal(leaves,1);tree=view(props);const pending=all(named(tree,'ResultDialog').props.actions).find(n=>n.props?.['aria-busy']);assert.equal(pending.props.disabled,true);assert.equal(all(named(tree,'ResultDialog').props.actions).find(n=>n.props?.onClick===props.onPlayAgain).props.disabled,true);
 view({...props,isOpen:false});tree=view(props);all(named(tree,'ResultDialog').props.actions).find(n=>n.props?.onClick&&text(n)==='살롱 로비로').props.onClick();assert.equal(leaves,2);view.dispose();
});
const {LoveLetterGame}=load('src/games/love-letter/ui/LoveLetterGame.tsx');
const state={matchState:'ROUND_END',playPhase:'ROUND_END',roundNumber:1,stateVersion:1,config:{targetTokens:4,turnTimeoutSeconds:0},players,secrets:{},deck:[],roundWinnerIds:['me']};
await check('results wait for synchronously queued physical events before timeline microtask starts',async()=>{
 const view=harness(LoveLetterGame),props={gameState:state,myUserId:'me',myHand:[]};view(props);timeline.enqueueAction({eventId:'final-card',actionId:'a',stateVersion:1,roundNumber:1,event:{type:'CARD_PLAYED',actorId:'me',card:{id:'c',value:4,name:'시녀'}}});assert.equal(timeline.isActionPlaying,false);assert.equal(timeline.hasPendingPresentation(),true);const tree=view(props);assert.equal(named(tree,'RoundResultModal').props.isOpen,false,'Queued final consequence cannot be covered by result');await Promise.resolve();view(props);let steps=0;while(timeline.hasPendingPresentation()&&steps++<20){timeline.advancePresentation();view(props);}assert.ok(steps>0&&steps<20);assert.equal(named(view(props),'RoundResultModal').props.isOpen,true,'Result opens after final physical step');view.dispose();
});
await check('canceling an unstarted queue releases the result immediately and rejects prior-round packets',async()=>{
 const view=harness(LoveLetterGame),props={gameState:state,myUserId:'me',myHand:[]};view(props);
 const event={eventId:'cancelled-card',actionId:'cancelled',stateVersion:1,roundNumber:1,event:{type:'CARD_PLAYED',actorId:'me',card:{id:'cancelled',value:4,name:'시녀'}}};
 timeline.enqueueAction(event);timeline.resetTimeline(2);
 assert.equal(timeline.hasPendingPresentation(),false,'Cancelled scheduled start must not keep terminal UI locked');
 timeline.enqueueAction({...event,eventId:'late-old-round'});assert.equal(timeline.hasPendingPresentation(),false);
 await Promise.resolve();assert.equal(named(view(props),'RoundResultModal').props.isOpen,true);view.dispose();
});
await check('pause owns focus instead of native round or match results',()=>{
 for(const matchState of ['ROUND_END','GAME_OVER']){const view=harness(LoveLetterGame);const tree=view({gameState:{...state,matchState},myUserId:'me',myHand:[]
,isPaused:true});assert.equal(named(tree,matchState==='ROUND_END'?'RoundResultModal':'MatchResultModal').props.isOpen,false);view.dispose();}
});
await check('comparison routes rebase on viewport resize while passive layout measurements stay frozen',()=>{
 const listeners=new Map();let resizedObserver,offset=0,completions=0;
 window.addEventListener=(name,fn)=>listeners.set(name,fn);window.removeEventListener=(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);};
 window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};
 window.ResizeObserver=class{constructor(fn){resizedObserver=fn;}observe(){}disconnect(){}};
 spatialRegistry={get(id,kind){return{parentElement:{},querySelector(){return null;},getBoundingClientRect(){return{left:offset+(kind==='comparison-left'?100:kind==='comparison-right'?300:20),top:offset+50,width:80,height:112};}};}};
 const {SpatialMotionStage}=load('src/games/love-letter/presentation/SpatialMotionStage.tsx');
 const events=[{type:'CARD_PLAYED',actorId:'me',card:{id:'baron',value:3,name:'Baron'}},{type:'PLAYER_TARGETED',targetId:'other'},{type:'BARON_COMPARED',actorId:'me',targetId:'other',winnerId:'other',eliminatedId:'me',comparisonHands:{me:{id:'a',value:4},other:{id:'b',value:6}}}].map((event,i)=>({event,eventId:'e'+i,actionId:'compare',roundNumber:1,stateVersion:1}));
 const props={currentAction:{actionId:'compare',stateVersion:1,presentationIndex:2,presentationEvents:events},localUserId:'me',players,onReturnCard(){},onPhaseComplete(){completions++;}};
 const view=harness(SpatialMotionStage);const cards=tree=>all(tree).filter(n=>n.props?.identity?.startsWith('comparison:'));
 try{
  let tree=view(props);assert.equal(cards(tree)[0].props.to.x,100);
  offset=40;resizedObserver();tree=view.flush();assert.equal(cards(tree)[0].props.to.x,100,'ordinary layout change must not bend a comparison route');assert.equal(listeners.has('scroll'),false);
  const oldCards=cards(tree);oldCards[0].props.onComplete();
  listeners.get('resize')();tree=view.flush();assert.equal(cards(tree)[0].props.to.x,140,'real viewport resize must rebase comparison destination');assert.equal(cards(tree)[1].props.to.x,340);
  assert.equal(completions,0,'remeasurement cannot release completion barrier');
  oldCards[1].props.onComplete();assert.equal(completions,0,'superseded route callback cannot release current comparison');
  assert.notEqual(cards(tree)[0].props.stepId,oldCards[0].props.stepId,'both members re-complete the rebased route');
  cards(tree)[1].props.onComplete();assert.equal(completions,0,'member completed before resize must complete its new route');cards(tree)[0].props.onComplete();cards(tree)[0].props.onComplete();assert.equal(completions,1);
  view({...props,currentAction:{...props.currentAction,presentationIndex:5}});offset=80;listeners.get('resize')();view.flush();
  tree=view({...props,currentAction:{...props.currentAction,presentationIndex:6}});assert.equal(cards(tree)[0].props.from.x,180,'resize during cleanup must invalidate the later comparison settle route');
 }finally{view.dispose();assert.equal(listeners.has('resize'),false);}
});
await check('new comparison cards wait for current hand anchors without remounting the played card',()=>{
 let actorAvailable=false;const frames=[];
 window.addEventListener=()=>{};window.removeEventListener=()=>{};window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};
 window.ResizeObserver=class{observe(){}disconnect(){}};
 spatialRegistry={get(id,kind){if(id==='me'&&kind.startsWith('hand-slot')&&!actorAvailable)return null;return{parentElement:{},querySelector(){return null;},getBoundingClientRect(){return{left:id==='me'?420:80,top:220,width:96,height:137};}};}};
 const {SpatialMotionStage}=load('src/games/love-letter/presentation/SpatialMotionStage.tsx');
 const events=[{type:'CARD_PLAYED',actorId:'me',card:{id:'baron',value:3}},{type:'PLAYER_TARGETED',targetId:'other'},{type:'BARON_COMPARED',actorId:'me',targetId:'other',comparisonHands:{me:{id:'a',value:4},other:{id:'b',value:6}}}].map((event,i)=>({event,eventId:'mount'+i,actionId:'mount',roundNumber:1,stateVersion:1}));
 const props={currentAction:{actionId:'mount',stateVersion:1,presentationIndex:1,presentationEvents:events},localUserId:'me',players,onReturnCard(){}};
 const view=harness(SpatialMotionStage,tree=>frames.push(tree));
 try{
  const target=view(props);const played=all(target).find(n=>n.props?.identity==='played:baron');assert.ok(played);
  actorAvailable=true;frames.length=0;view({...props,currentAction:{...props.currentAction,presentationIndex:2}});
  const mounted=frames.flatMap(all).filter(n=>n.props?.identity==='comparison:mount:me');assert.ok(mounted.length);
  for(const card of mounted){assert.equal(card.props.from.x,420,'first comparison mount must use current actor hand, never prior fallback');assert.equal(card.props.from.width,96);}
  for(const frame of frames){assert.equal(all(frame).find(n=>n.props?.identity==='played:baron')?.key,played.key,'existing played object must retain its key');}
  const identical=harness(SpatialMotionStage);try{identical(props);const tree=identical({...props,currentAction:{...props.currentAction,presentationIndex:2}});assert.ok(all(tree).some(n=>n.props?.identity==='comparison:mount:me'),'identical geometry must still release first-mount readiness');}finally{identical.dispose();}
  const retries=[];let completions=0;actorAvailable=false;window.requestAnimationFrame=fn=>{retries.push(fn);return retries.length;};
  const missing=harness(SpatialMotionStage);try{const tree=missing({...props,currentAction:{...props.currentAction,presentationIndex:2},onPhaseComplete(){completions++;}});assert.equal(all(tree).filter(n=>n.props?.identity?.startsWith('comparison:')).length,0);assert.equal(retries.length,1);retries[0]();assert.equal(retries.length,2);retries[1]();assert.equal(completions,1,'missing anchor still settles after two bounded retries');}finally{missing.dispose();}
 }finally{view.dispose();}
});
mkdirSync('.omo/evidence/ui-ux/task-9',{recursive:true});writeFileSync('.omo/evidence/ui-ux/task-9/regression.json',JSON.stringify({invocation:'node tests/love_letter_results.test.js',checks},null,2));if(checks.some(c=>!c.passed))process.exitCode=1;
