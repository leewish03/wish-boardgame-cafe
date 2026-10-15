import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { motion, useReducedMotion } from 'framer-motion';
import { THEME } from '../../shared/theme';
import { boards, ink, colorName, crossingLabel, waterGroups, mapFocusView } from './model';

const Frame = styled.div`position:relative;flex:1;min-width:0;min-height:0;overflow:hidden;background:${ink.paper};border:1px solid ${THEME.goldAntique};border-radius:${THEME.radius.lg};box-shadow:inset 0 0 35px #302b2420;svg{display:block;width:100%;height:100%;touch-action:none;user-select:none;}svg [role=button]:focus{outline:none;stroke:${THEME.foreground};stroke-width:4px;}svg text{pointer-events:none;font-family:${THEME.font.sans};}`;
const Tools = styled.div`position:absolute;top:8px;left:8px;display:flex;gap:4px;flex-wrap:wrap;max-width:calc(100% - 16px);button{min-width:44px;min-height:44px;border:1px solid ${THEME.borderGold};border-radius:6px;background:#fffdf5ee;color:${ink.text};font:700 12px ${THEME.font.sans};cursor:pointer;padding:0 10px;&:hover{background:${THEME.secondary};}&:active{box-shadow:inset 0 0 0 2px ${THEME.goldAntique};}&:focus-visible{outline:3px solid ${THEME.gold};}}`;
const Compass = styled.div`position:absolute;right:12px;bottom:12px;color:${ink.text};font:700 12px ${THEME.font.serif};pointer-events:none;text-align:center;`;
const Legend = styled.div`position:absolute;bottom:8px;left:8px;max-width:75%;padding:6px 8px;background:#fffdf5e8;border-radius:4px;font-size:11px;color:${ink.text};pointer-events:none;`;

function roadPath(board, from, to) {
  if (from == null || to == null || !board.byId[from] || !board.byId[to]) return [];
  const adjacency = {};
  for (const [a,b] of board.edges) { (adjacency[a] ??= []).push(b); (adjacency[b] ??= []).push(a); }
  const queue = [{path:[from],steps:0}], seen = new Set([`${from}:0`]);
  for (let i=0; i<queue.length; i++) {
    const {path,steps}=queue[i], last=path.at(-1);
    if (String(last)===String(to)) return path.map(id=>board.byId[id]);
    for(const next of adjacency[last] ?? []) {
      const count=steps+(board.byId[next]?.kind==='crossing'?1:0),key=`${next}:${count}`;
      if(count<=2&&!seen.has(key)) { seen.add(key); queue.push({path:[...path,next],steps:count}); }
    }
  }
  return [];
}

export default function MapViewport({ game, secret, targets, selectedKeys=[], onPick, focusKey, events=[], batchId, disabled }) {
  const board = boards[game.gameType], reduced = useReducedMotion();
  const [view,setView] = useState({x:0,y:0,w:board.width,h:board.height});
  const [size,setSize] = useState({width:600,height:400});
  const svgRef=useRef(null), drag=useRef(null), moved=useRef(false);
  useEffect(()=>{
    const observer=new window.ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));
    if(svgRef.current)observer.observe(svgRef.current);
    return()=>observer.disconnect();
  },[]);
  const screenUnit=Math.max(view.w/Math.max(1,size.width),view.h/Math.max(1,size.height));
  const fit=()=>setView({x:0,y:0,w:board.width,h:board.height});
  const focus=(key)=>{const next=mapFocusView(board,[key]);if(next)setView(next);};
  const zoom=(factor)=>setView(v=>{const w=Math.max(board.width*.18,Math.min(board.width*1.3,v.w*factor));const h=w*board.height/board.width;return{x:v.x+(v.w-w)/2,y:v.y+(v.h-h)/2,w,h};});
  useEffect(()=>{
    if(!focusKey)return;
    const crime=events.find(e=>e.type==='CRIME_DISCOVERED'&&e.positions?.some(n=>`n:${n}`===focusKey));
    const next=mapFocusView(board,crime?crime.positions.map(n=>`n:${n}`):[focusKey]);
    if(next)setView(next);
  },[focusKey,batchId]);
  useEffect(()=>{if(['SET_DISCOVERIES','CHOOSE_HIDEOUT','PLACE_WOMEN','PLACE_PATROLS'].includes(game.playPhase))fit();},[game.playPhase]);
  const privateRole = secret?.role === 'JACK';
  const clues=new Set(game.clues ?? []), crimes=new Set(game.crimeScenes ?? game.revealed ?? []);
  const women=new Set((game.women ?? []).map(w=>w.position).concat(game.wretched ?? []));
  const movingWomen=events.filter(e=>e.type==='WRETCHED_MOVED');
  const route=privateRole ? secret.trail ?? secret.route ?? [] : [];
  const jack=privateRole ? board.byKey[`n:${secret.position}`] : null;
  const privateMove=privateRole?events.find(e=>e.type==='JACK_ROUTE'):null;
  const coach=events.some(e=>e.type==='JACK_MOVED'&&['COACH','coach'].includes(e.mode));
  const jackPath=privateRole?(privateMove?.path??(coach?route.slice(-2):[])).map(n=>board.byKey[`n:${n}`]).filter(Boolean):[];
  const patrols=(game.patrols??[]).map(p=>{const own=secret.role!=='JACK'?secret.patrols?.find(q=>q.position===p.position):null;return own?{...p,officerId:own.officerId,known:true}:p;});
  const visiblePolice=game.gameType==='WHITECHAPEL'&&['CHOOSE_HIDEOUT','PLACE_WOMEN','PLACE_PATROLS','KILL_OR_WAIT','MOVE_WRETCHED','REVEAL_PATROL'].includes(game.playPhase)?[]:game.police??[];
  const moving=useMemo(()=>Object.fromEntries(events.filter(e=>e.type==='POLICE_MOVED').map(e=>[e.officerId ?? e.pawnId,roadPath(board,e.from,e.to)])),[board,events]);
  const feedback=events.filter(e=>['CLUE_SEARCHED','ARREST_ATTEMPTED','DISCOVERY_REVEALED'].includes(e.type));
  const privateGoals=privateRole ? secret.discoveries ?? (secret.hideout != null ? [secret.hideout] : []) : [];
  const pick=(n)=>{if(!moved.current&&!disabled&&targets.has(n.key))onPick(n.key);};
  return <Frame aria-label="사건 지도">
    <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} aria-label={game.gameType==='WHITEHALL'?'화이트홀 지도':'화이트채플 지도'}
      onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,view};moved.current=false;}}
      onPointerMove={e=>{if(!drag.current)return;const d=drag.current;if(Math.abs(e.clientX-d.x)+Math.abs(e.clientY-d.y)>5)moved.current=true;if(moved.current){const rect=svgRef.current.getBoundingClientRect();const scale=Math.max(d.view.w/rect.width,d.view.h/rect.height);setView({...d.view,x:d.view.x-(e.clientX-d.x)*scale,y:d.view.y-(e.clientY-d.y)*scale});}}}
      onPointerUp={()=>{drag.current=null;}} onPointerLeave={()=>{drag.current=null;}}>
      <defs><pattern id="case-paper" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M0 16h32M16 0v32" stroke={ink.road} strokeOpacity=".13" strokeWidth=".5"/></pattern><filter id="token-shadow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity=".25"/></filter></defs>
      <rect x="-500" y="-500" width={board.width+1000} height={board.height+1000} fill={ink.paper}/><rect width={board.width} height={board.height} fill="url(#case-paper)"/>
      {game.gameType==='WHITEHALL'&&<>{waterGroups.map((group,i)=><polyline key={i} points={group.map(id=>board.byKey[`n:${id}`]).map(n=>`${n.x},${n.y}`).join(' ')} stroke={ink.river} strokeWidth="32" strokeLinejoin="round" strokeLinecap="round" fill="none" opacity=".65"/>)}<path d="M600 20v1160M20 600h1160" stroke={ink.road} strokeDasharray="6 10" opacity=".5"/>{[['북서',40,45],['북동',1080,45],['남서',40,1170],['남동',1080,1170]].map(([t,x,y])=><text key={t} x={x} y={y} fontSize="18" fill={ink.water}>{t}</text>)}</>}
      <g stroke={ink.road} strokeWidth={game.gameType==='WHITEHALL'?5:3} strokeLinecap="round">{board.edges.map(([a,b],i)=>{const p=board.byId[a],q=board.byId[b];return p&&q?<line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y}/>:null;})}</g>
      <g stroke="#fffaf0" strokeWidth="1" strokeLinecap="round" opacity=".7">{board.edges.map(([a,b],i)=>{const p=board.byId[a],q=board.byId[b];return p&&q?<line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y}/>:null;})}</g>
      {route.length>1&&<polyline points={route.map(n=>board.byKey[`n:${n}`]).filter(Boolean).map(n=>`${n.x},${n.y}`).join(' ')} fill="none" stroke={ink.crime} strokeWidth="2" strokeDasharray="5 5" opacity=".65"/>}
      {board.nodes.map(n=>{const location=n.kind==='location',active=targets.has(n.key)&&!disabled,selected=selectedKeys.includes(n.key),radius=location?(game.gameType==='WHITEHALL'?12:8):4;
        return <g key={n.key} transform={`translate(${n.x},${n.y})`} role={active?'button':undefined} tabIndex={active?0:undefined} aria-label={active?`${location?`장소 ${n.value}`:crossingLabel(game.gameType,n.value)} 선택`:undefined} onClick={()=>pick(n)} onKeyDown={e=>{if(active&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onPick(n.key);}}} style={{cursor:active?'pointer':'default'}}>
          {active&&<circle r={radius+5} fill={THEME.goldLight} stroke={ink.text} strokeWidth="1"/>}
          <circle r={radius} fill={location?(n.color==='blue'?ink.river:n.isCrimeSite?ink.crime:n.color==='black'?ink.text:'#fffaf0'):(n.isPoliceStart?THEME.gold:ink.text)} stroke={ink.road} strokeWidth=".8"/>
          {location&&<text textAnchor="middle" dominantBaseline="central" fontSize={game.gameType==='WHITEHALL'?10:7} fontWeight="700" fill={n.isCrimeSite||n.color==='black'?'#fff':ink.text}>{n.number}</text>}
          {selected&&<circle r={radius+7} fill="none" stroke={ink.crime} strokeWidth="3"/>}
          {privateGoals.includes(n.value)&&location&&<text x="0" y={-radius-8} textAnchor="middle" fontSize="14" fill={ink.crime}>⌂</text>}
          {clues.has(n.value)&&location&&<circle cx={radius+3} cy={-radius} r="4" fill={THEME.gold} stroke={ink.text}/ >}
          {women.has(n.value)&&location&&!movingWomen.some(e=>e.to===n.value)&&<path d={`M${radius+3} 0l-4 9h8z`} fill={ink.crime} stroke="#fff"/>}
        </g>;
      })}
      {board.nodes.filter(n=>n.kind==='location'&&crimes.has(n.value)).map(n=><g key={`crime-${n.key}`} transform={`translate(${n.x},${n.y})`} pointerEvents="none"><path d={`M0 0v${-5*screenUnit}`} stroke={ink.crime} strokeWidth={screenUnit}/><rect x={-16*screenUnit} y={-23*screenUnit} width={32*screenUnit} height={18*screenUnit} rx={3*screenUnit} fill={ink.crime}/><text y={-14*screenUnit} textAnchor="middle" dominantBaseline="central" fontSize={12*screenUnit} fontWeight="700" fill="#fff">{n.number}</text></g>)}
      {movingWomen.map((e,i)=>{const from=board.byKey[`n:${e.from}`],to=board.byKey[`n:${e.to}`];return from&&to?<motion.g key={`${batchId}-woman-${i}`} initial={{x:reduced?to.x:from.x,y:reduced?to.y:from.y}} animate={{x:to.x,y:to.y}} transition={{duration:reduced ? .01 : .65,ease:'easeInOut'}} pointerEvents="none"><circle cy="-6" r="3" fill={ink.crime} stroke="#fff"/><path d="M0 -3l-6 12h12z" fill={ink.crime} stroke="#fff"/></motion.g>:null;})}
      {patrols.map(p=>{const n=board.byKey[`c:${p.position}`],known=p.revealed||p.known;return n?<g key={p.position} transform={`translate(${n.x},${n.y})`} pointerEvents="none"><rect x="-7" y="-7" width="14" height="14" rx="2" fill={known&&p.officerId?ink[p.officerId]:ink.text} stroke={THEME.gold}/><text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="10">{known?(p.officerId?'●':'×'):'?'}</text>{known&&<text y="19" textAnchor="middle" fill={ink.text} fontSize="8">{p.officerId?colorName[p.officerId]:'가짜'}</text>}</g>:null;})}
      {visiblePolice.map(p=>{const n=board.byKey[`c:${p.position}`];if(!n)return null;const path=moving[p.id]??[],c=p.id.toLowerCase();return <motion.g key={p.id} initial={false} animate={{x:!reduced&&path.length>1?path.map(q=>q.x):n.x,y:!reduced&&path.length>1?path.map(q=>q.y):n.y}} transition={{duration:reduced ? .01 : .65,ease:'easeInOut'}} pointerEvents="none" filter="url(#token-shadow)"><path d="M-7 8L-5 -3Q-9 -12 0 -12Q9 -12 5 -3L7 8Z" fill={ink[c]} stroke="#fff" strokeWidth="1.5"/><text y="20" textAnchor="middle" fontSize="8" fill={ink.text}>{colorName[c]}</text></motion.g>;})}
      {jack&&<motion.g initial={false} animate={{x:!reduced&&jackPath.length>1?[null,...jackPath.map(n=>n.x)]:jack.x,y:!reduced&&jackPath.length>1?[null,...jackPath.map(n=>n.y)]:jack.y}} transition={{duration:reduced ? .01 : .65}} pointerEvents="none"><path d="M-8 8L-5 -5H5L8 8Z M-9 -5H9 M-4 -5V-10H4V-5" fill={ink.text} stroke={ink.crime} strokeWidth="1.5"/><text y="22" textAnchor="middle" fontSize="9" fill={ink.crime}>잭 · 나만 보임</text></motion.g>}
      {feedback.map((e,i)=>{const n=board.byKey[`n:${e.location??e.to}`];if(!n)return null;const hit=e.found||e.caught||e.type==='DISCOVERY_REVEALED';return <motion.g key={`${batchId}-${i}`} initial={{opacity:0}} animate={{opacity:[0,1,1]}} transition={{duration:reduced?.1:.65}} pointerEvents="none"><circle cx={n.x} cy={n.y} r="20" fill={hit?THEME.goldLight:'#fffdf5'} fillOpacity=".8" stroke={hit?ink.crime:ink.text} strokeWidth="2"/><text x={n.x} y={n.y} dominantBaseline="central" textAnchor="middle" fontSize="16" fill={ink.text}>{hit?'!':'×'}</text></motion.g>;})}
    </svg>
    <Tools aria-label="지도 조작"><button onClick={()=>zoom(.7)} aria-label="지도 확대">＋</button><button onClick={()=>zoom(1.4)} aria-label="지도 축소">−</button><button onClick={fit}>전체 지도</button><button onClick={()=>focus(focusKey??(jack?jack.key:null)??`c:${game.police?.[game.pawnIndex??0]?.position}`)}>현재 말</button></Tools>
    <Compass>북<br/>↑<br/>N</Compass><Legend>번호: 잭 이동 · 교차로: 수사관 · 금색 점: 흔적<br/>지도를 끌어 이동 · ＋로 확대</Legend>
  </Frame>;
}
