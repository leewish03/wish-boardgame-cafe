import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import React from 'react';
import { mapHitChoices, revealMapPoint } from '../src/games/hidden-movement/mapInput.js';

const require = createRequire(import.meta.url);
const styledModule = require('styled-components');
const styled = Object.assign(styledModule.default, styledModule);
const slots = [], effects = [];
let cursor = 0, changed = false;
const react = { ...React,
  useState(initial) { const i=cursor++; if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial; return [slots[i],value=>{const next=typeof value==='function'?value(slots[i]):value;if(!Object.is(next,slots[i])){slots[i]=next;changed=true;}}]; },
  useRef(initial) { const i=cursor++; return slots[i]??(slots[i]={current:initial}); },
  useMemo(fn) { return fn(); }, useCallback(fn) { return fn; },
  useEffect(fn,deps) { const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>!Object.is(d,old[j]))){slots[i]=deps;effects.push(fn);} },
};
globalThis.window={addEventListener(){},removeEventListener(){},ResizeObserver:class { observe(){} disconnect(){} }};
function load(file) {
  const code=buildSync({entryPoints:[file],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'}).outputFiles[0].text;
  const module={exports:{}};
  new Function('require','module','exports',code)(name=>name==='react'?react:name==='styled-components'?styled:name==='framer-motion'?{...require(name),useReducedMotion:()=>false}:require(name),module,module.exports);
  return module.exports.default;
}
function render(Component,props) { let tree;for(let i=0;i<10;i++){cursor=0;changed=false;tree=Component(props);while(effects.length)effects.shift()();if(!changed)return tree;}throw new Error('Render failed to settle'); }
function all(tree) { if(!tree||typeof tree!=='object')return [];return [tree,...React.Children.toArray(tree.props?.children).flatMap(all)]; }
const MapViewport=load('src/games/hidden-movement/MapViewport.jsx');
const game={gameType:'WHITEHALL',playPhase:'POLICE_MOVE',police:[{id:'BLUE',position:'BB'}]};
let picked=null,actor=null;
const map=render(MapViewport,{game,secret:{role:'POLICE'},targets:new Set(['c:BB']),activeOfficer:'BLUE',selectableOfficers:['BLUE'],onPick:key=>picked=key,onSelectOfficer:id=>actor=id});
const pawn=all(map).find(node=>/파랑 경찰 (현재 위치 )?선택/.test(node.props?.['aria-label']??''));
assert.ok(pawn,'active pawn remains keyboard reachable');
pawn.props.onKeyDown({key:' ',preventDefault(){}});
assert.equal(picked,'c:BB','Active officer keyboard activation must select the same legal stay target as the destination list');
assert.equal(actor,null,'Stay activation must not clear the destination by reselecting its actor');
console.log('PASS active-officer stay input equivalence');

const points=[{key:'a',x:0,y:0,radius:4},{key:'b',x:30,y:0,radius:4}];
assert.deepEqual(mapHitChoices(points,{x:15,y:0},1).map(n=>n.key),['a','b'],'Overlapping invisible touch targets must offer both choices');
assert.deepEqual(mapHitChoices([...points].reverse(),{x:15,y:0},1).map(n=>n.key),['b','a'],'Drawing order cannot silently pick a dense target');
assert.deepEqual(mapHitChoices(points,{x:0,y:0},1).map(n=>n.key),['a'],'A uniquely painted visible object remains directly selectable');
assert.equal(mapHitChoices([points[0]],{x:21.9,y:0},1).length,1,'An isolated target has a 44px diameter');
assert.equal(mapHitChoices([points[0]],{x:22.1,y:0},1).length,0);
assert.equal(mapHitChoices([points[0]],{x:65.9,y:0},3).length,1,'44px touch region remains screen sized at zoom-out');
const view={x:0,y:0,w:100,h:100};
assert.equal(revealMapPoint(view,{x:50,y:50},1),view,'Visible keyboard destination must preserve camera');
assert.deepEqual(revealMapPoint(view,{x:900,y:800},1),{x:850,y:750,w:100,h:100},'Offscreen focus centers without changing zoom');
console.log('PASS density disambiguation, isolated 44px and offscreen focus');

slots.length=0;
const HiddenMovementGame=load('src/games/hidden-movement/HiddenMovementGame.jsx');
const commands=[...Array.from({length:18},(_,i)=>({type:'POLICE_MOVE',officerId:'blue',to:i+1})),{type:'SEARCH',officerId:'blue',to:1}];
const props={roomState:{code:'TEST',game:{gameType:'WHITECHAPEL',playPhase:'POLICE_MOVE',stateVersion:1,players:[{id:'me'}],police:[{id:'blue',position:1}]},mySecret:{role:'POLICE',legal:{commands}}},currentUser:{id:'me'},socket:{connected:true,emit(){},on(){},off(){}}};
let tree=render(HiddenMovementGame,props);
let input=all(tree).find(n=>n.props?.['aria-label']==='목적지 번호 찾기');
assert.ok(input);
input.props.onChange({target:{value:'[malformed-no-match]'}});
tree=render(HiddenMovementGame,props);
assert.equal(all(tree).find(n=>n.props?.['aria-label']==='가능한 행동').props.children.length,0);
const mode=all(tree).find(n=>n.props?.children==='수색');
mode.props.onClick();
tree=render(HiddenMovementGame,props);
const options=all(tree).find(n=>n.props?.['aria-label']==='가능한 행동');
assert.equal(options.props.children.length,1,'Changing from >15 to <=15 destinations must not preserve an invisible unmatched query');
assert.equal(options.props.children[0].props.children,'파랑 1번 수색');
options.props.children[0].props.onClick();
tree=render(HiddenMovementGame,props);
assert.equal(all(tree).find(n=>n.props?.['aria-label']==='가능한 행동').props.children[0].props['aria-pressed'],true);
console.log('PASS malformed query reset and selected list semantics');

for(const context of ['actor','origin']) {
  slots.length=0;
  const many=Array.from({length:18},(_,i)=>context==='actor'?{type:'POLICE_MOVE',officerId:'blue',to:i+1}:{type:'MOVE_WRETCHED',from:1,to:i+1});
  const one=context==='actor'?{type:'POLICE_MOVE',officerId:'red',to:20}:{type:'MOVE_WRETCHED',from:2,to:20};
  const inputProps={...props,roomState:{...props.roomState,mySecret:{role:'POLICE',legal:{commands:[...many,one]}}}};
  let inputTree=render(HiddenMovementGame,inputProps);
  all(inputTree).find(n=>n.props?.['aria-label']==='목적지 번호 찾기').props.onChange({target:{value:'no-match'}});
  inputTree=render(HiddenMovementGame,inputProps);
  if(context==='actor')all(inputTree).find(n=>Array.isArray(n.props?.children)&&n.props.children.join('')==='빨강 경찰').props.onClick();
  else all(inputTree).find(n=>n.type==='select').props.onChange({target:{value:'2'}});
  inputTree=render(HiddenMovementGame,inputProps);
  assert.equal(all(inputTree).find(n=>n.props?.['aria-label']==='가능한 행동').props.children.length,1,`${context} changes must clear the previous unmatched query`);
}
console.log('PASS actor and origin query context changes');
