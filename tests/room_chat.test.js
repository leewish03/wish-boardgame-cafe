import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import React from 'react';

const require = createRequire(import.meta.url);
let active;
let viewport={top:0,left:0,width:390,height:844};
const hooks = { ...React,
  useState(initial) { const h=active,i=h.cursor++; if (!(i in h.slots)) h.slots[i]=typeof initial==='function'?initial():initial; return [h.slots[i],value=>{const next=typeof value==='function'?value(h.slots[i]):value;if(!Object.is(next,h.slots[i])){h.slots[i]=next;h.changed=true;}}]; },
  useRef(initial) { const h=active,i=h.cursor++; return h.slots[i]??(h.slots[i]={current:initial}); },
  useEffect(fn,deps) { const h=active,i=h.cursor++,prev=h.slots[i]; if(!prev||deps.some((d,j)=>!Object.is(d,prev[j]))){h.slots[i]=deps;h.effects.push(fn);} },
};
hooks.useLayoutEffect=hooks.useEffect;
const styled=require('styled-components');
const compiled=transformSync(readFileSync(process.env.CHAT_TEST_SOURCE || 'src/shared/RoomChat.jsx','utf8').replaceAll('/src/shared/', './'),{loader:'jsx',format:'cjs'}).code;
const component={exports:{}};
new Function('require','module','exports',compiled)(name=>{
  if(name==='react')return hooks;
  if(name==='react-dom')return {createPortal:content=>content};
  if(name==='styled-components')return Object.assign(styled.default,styled);
  if(name==='./theme')return {THEME:{radius:{lg:'10px'},shadows:{},font:{},gradients:{},interaction:{}}};
  if(name==='./components')return {Input:'input'};
  if(name==='./useVisualViewportRect')return {useVisualViewportRect:()=>viewport};
  if(name==='./useDialogFocus')return {useDialogFocus:()=>({current:null})};
  return require(name);
},component,component.exports);
globalThis.document={body:{}};
const all=tree=>tree&&typeof tree==='object'?[tree,...React.Children.toArray(tree.props?.children).flatMap(all)]:[];
const messages=end=>Array.from({length:Math.min(end,30)},(_,i)=>({id:`m${Math.max(1,end-29)+i}`,text:`message ${Math.max(1,end-29)+i}`}));
function harness(initial={}) {
  const h={slots:[],cursor:0,effects:[],changed:false};
  let props={messages:messages(30),mode:'sheet',...initial},tree;
  const feed={scrollTop:700,scrollHeight:1000,clientHeight:300,children:[],getBoundingClientRect:()=>({top:0})};
  const render=(next={})=>{props={...props,...next};for(let i=0;i<12;i++){active=h;h.cursor=0;h.changed=false;tree=component.exports.RoomChat(props);const node=all(tree).find(n=>n.type?.target==='div'&&n.ref&&n.props.children instanceof Array);if(node)node.ref.current=feed;while(h.effects.length)h.effects.shift()();if(!h.changed)return tree;}throw Error('render loop');};
  return {render,feed,get tree(){return tree;},find:label=>all(tree).find(n=>n.props?.['aria-label']===label),open(){const n=all(tree).find(n=>n.props?.['aria-label']?.startsWith('채팅 열기'));n.props.onClick();return render();},input(value){all(tree).find(n=>n.props.name==='game-chat-message').props.onChange({target:{value}});render();},submit(){return all(tree).find(n=>n.props.onSubmit).props.onSubmit({preventDefault(){}});}};
}
const checks=[];
async function check(name,fn){try{await fn();checks.push(true);console.log('PASS '+name);}catch(error){checks.push(false);console.error('FAIL '+name+': '+error.message);}}
await check('retention cap counts each unseen identity and ignores repeated snapshots',()=>{const h=harness();h.render();for(let n=31;n<=35;n++)h.render({messages:messages(n)});const trigger=all(h.tree).find(n=>n.props?.['aria-label']?.startsWith('채팅 열기'));assert.ok(all(trigger).some(n=>n.props.children===5),'messages 31–35 must expose unread 5');h.render({messages:messages(35)});assert.ok(all(h.tree).some(n=>n.props.children===5),'duplicate snapshot must not increase unread');h.open();assert.ok(!all(h.tree).some(n=>n.props.children===5),'opening at bottom reads latest');});
await check('reader above bottom receives message 36 without scrolling and can jump to latest',()=>{const h=harness();h.render();h.open();h.feed.scrollTop=120;const feed=all(h.tree).find(n=>n.props.onScroll);assert.ok(feed,'feed must record intentional scrolling');feed.props.onScroll();h.render({messages:messages(36)});assert.equal(h.feed.scrollTop,120,'incoming messages must preserve older position');const jump=all(h.tree).find(n=>n.props?.onClick&&JSON.stringify(n.props.children).includes('새 메시지'));assert.ok(jump,'unread arrivals must have a visible jump action');jump.props.onClick();h.render();assert.equal(h.feed.scrollTop,h.feed.scrollHeight);});
await check('false rejection keeps draft, shows error, locks duplicate send and allows one retry',async()=>{let resolve,calls=0;const h=harness({onSend:()=>{calls++;return new Promise(r=>resolve=r);}});h.render();h.open();h.input('retry once');const first=h.submit();const duplicate=h.submit();assert.equal(calls,1);resolve(false);await first;await duplicate;h.render();assert.equal(h.find('메시지 보내기').props.disabled,false);assert.equal(all(h.tree).find(n=>n.props.name==='game-chat-message').props.value,'retry once');assert.ok(all(h.tree).some(n=>n.props.role==='alert'),'rejected false result needs visible error');const retry=h.submit();resolve(true);await retry;h.render();assert.equal(calls,2);assert.equal(all(h.tree).find(n=>n.props.name==='game-chat-message').props.value,'');});
await check('sheet closure preserves draft and rejected error',async()=>{const h=harness({onSend:async()=>{throw Error('offline');}});h.render();h.open();h.input('keep me');await h.submit();h.render();h.find('채팅 닫기').props.onClick();h.render();h.open();assert.equal(all(h.tree).find(n=>n.props.name==='game-chat-message').props.value,'keep me');assert.ok(all(h.tree).some(n=>n.props.role==='alert'&&n.props.children==='offline'));});
await check('retained message anchor survives eviction and stale replay is not unread again',()=>{
  const h=harness();h.render();h.open();h.feed.scrollTop=120;
  let anchorTop=10;
  h.feed.children=[{dataset:{messageId:'m10'},getBoundingClientRect:()=>({top:anchorTop,bottom:anchorTop+20})}];
  all(h.tree).find(n=>n.props.onScroll).props.onScroll();
  anchorTop=-20;h.render({messages:messages(31)});
  assert.equal(h.feed.scrollTop,90,'eviction keeps the same retained line at its prior visual offset');
  h.render({messages:messages(30)});
  const jump=all(h.tree).find(n=>n.props.onClick&&JSON.stringify(n.props.children).includes('새 메시지'));
  assert.ok(JSON.stringify(jump.props.children).includes('1'),'stale IDs must not create arrivals');
});
await check('late accepted ACK does not erase a newer draft entered during pending send',async()=>{
  let accept,calls=0;const h=harness({onSend:()=>{calls++;return new Promise(resolve=>accept=resolve);}});
  h.render();h.open();h.input('first');const pending=h.submit();h.input('second');await h.submit();
  assert.equal(calls,1);accept(true);await pending;h.render();
  assert.equal(all(h.tree).find(n=>n.props.name==='game-chat-message').props.value,'second');
});
await check('opening after closed viewport resize stays at latest when measured sheet narrows',()=>{
  const h=harness();viewport={top:0,left:0,width:1920,height:844};h.feed.scrollHeight=300;h.render();h.open();
  h.feed.scrollTop=0;h.feed.scrollHeight=1200;viewport={...viewport,width:390};h.render();
  assert.equal(h.feed.scrollTop,1200,'measured viewport change must settle the latest message after initial wide layout');
});
if(checks.some(value=>!value))process.exitCode=1;
