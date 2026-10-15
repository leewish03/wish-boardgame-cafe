import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { motion, useReducedMotion } from 'framer-motion';
import { THEME } from '../../shared/theme';
import { boards, ink, colorName, crossingLabel, waterGroups, mapFocusView, patrolHitRadius } from './model';
import useMapGestures from './useMapGestures';
import { mapHitChoices, revealMapPoint } from './mapInput';

const Frame = styled.div`position:relative;flex:1;min-width:0;min-height:0;padding-top:60px;box-sizing:border-box;overflow:hidden;background:${ink.paper};border:1px solid ${THEME.goldAntique};border-radius:${THEME.radius.lg};box-shadow:inset 0 0 35px #302b2420;svg{display:block;width:100%;height:100%;touch-action:none;user-select:none;}svg [role=button]:focus{outline:none;stroke:${THEME.foreground};stroke-width:4px;}svg text{pointer-events:none;font-family:${THEME.font.sans};}@media(orientation:landscape) and (max-height:500px){padding-top:0;padding-right:108px;}`;
const Tools = styled.div`position:absolute;top:8px;left:8px;display:flex;gap:4px;flex-wrap:wrap;max-width:calc(100% - 16px);button{min-width:44px;min-height:44px;border:1px solid ${THEME.borderGold};border-radius:6px;background:#fffdf5ee;color:${ink.text};font:700 12px ${THEME.font.sans};cursor:pointer;padding:0 10px;&:hover{background:${THEME.secondary};}&:active{box-shadow:inset 0 0 0 2px ${THEME.goldAntique};}&:focus-visible{outline:3px solid ${THEME.gold};}}@media(orientation:landscape) and (max-height:500px){left:auto;right:8px;display:grid;grid-template-columns:44px 44px;button{padding:2px;font-size:11px;}}`;
const Compass = styled.div`position:absolute;right:12px;bottom:12px;color:${ink.text};font:700 12px ${THEME.font.serif};pointer-events:none;text-align:center;`;
const Legend = styled.div`position:absolute;bottom:8px;left:8px;max-width:75%;padding:6px 8px;background:#fffdf5e8;border-radius:4px;font-size:11px;color:${ink.text};pointer-events:none;@media(orientation:landscape) and (max-height:500px){display:none;}`;
const Nearby = styled.div`position:absolute;z-index:1;left:8px;right:8px;bottom:8px;max-height:55%;overflow:auto;padding:8px;background:${THEME.surfaceCard};border:1px solid ${THEME.border};border-radius:${THEME.radius.md};color:${THEME.foreground};font-size:14px;display:flex;flex-wrap:wrap;gap:8px;strong{flex:1;align-self:center;}button{min-height:44px;min-width:44px;padding:8px;border:1px solid ${THEME.border};border-radius:${THEME.radius.md};background:${THEME.surfaceCard};color:${THEME.foreground};font:inherit;cursor:pointer;}button:focus-visible{outline:3px solid ${THEME.gold};} .choices{width:100%;display:flex;flex-wrap:wrap;gap:8px;}`;

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

export default function MapViewport({ game, secret, targets, selectedKeys=[], onPick, focusKey, focusedKey, preview=[], draftPatrols=[], activeOfficer, selectableOfficers=[], onSelectOfficer, events=[], batchId, disabled }) {
  const board = boards[game.gameType], reduced = useReducedMotion();
  const [view,setView] = useState({x:0,y:0,w:board.width,h:board.height});
  const [size,setSize] = useState({width:600,height:400});
  const [nearby,setNearby] = useState([]);
  const svgRef=useRef(null);
  const {moved,handlers}=useMapGestures(svgRef,view,setView,board);
  useEffect(()=>{
    const observer=new window.ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));
    if(svgRef.current)observer.observe(svgRef.current);
    return()=>observer.disconnect();
  },[]);
  const screenUnit=Math.max(view.w/Math.max(1,size.width),view.h/Math.max(1,size.height));
  const reveal=key=>setView(v=>revealMapPoint(v,board.byKey[key],screenUnit));
  useEffect(()=>{if(focusedKey)reveal(focusedKey);},[focusedKey]);
  const targetSignature=[...targets].join('|');
  useEffect(()=>setNearby([]),[targetSignature,activeOfficer,disabled,game.stateVersion]);
  const fit=()=>setView({x:0,y:0,w:board.width,h:board.height});
  const focus=(key)=>{const next=mapFocusView(board,[key]);if(next)setView(next);};
  const zoom=(factor)=>setView(v=>{const w=Math.max(board.width*.18,Math.min(board.width*1.3,v.w*factor));const h=w*board.height/board.width;return{x:v.x+(v.w-w)/2,y:v.y+(v.h-h)/2,w,h};});
  useEffect(()=>{
    const crime=events.find(e=>e.type==='CRIME_DISCOVERED');
    if(!crime)return;
    const next=mapFocusView(board,crime.positions.map(n=>`n:${n}`));
    if(next)setView(next);
  },[batchId]);
  useEffect(()=>{if(['SET_DISCOVERIES','CHOOSE_HIDEOUT','PLACE_WOMEN','PLACE_PATROLS'].includes(game.playPhase))fit();},[game.playPhase]);
  const patrolKeys=draftPatrols.map(p=>`c:${p.position}`).join('|');
  const patrolPoints=draftPatrols.map(p=>board.byKey[`c:${p.position}`]).filter(Boolean);
  useEffect(()=>{
    if(!patrolKeys)return;
    const next=mapFocusView(board,patrolKeys.split('|'));
    if(next)setView(next);
  },[patrolKeys,board]);
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
  const nodeRadius=n=>n.kind==='location'?(game.gameType==='WHITEHALL'?12:8):4;
  const inputItems=[...targets].map(key=>board.byKey[key]).filter(Boolean).map(n=>({...n,radius:nodeRadius(n),label:n.kind==='location'?`장소 ${n.value}`:crossingLabel(game.gameType,n.value)}));
  for(const p of visiblePolice.filter(p=>selectableOfficers.includes(p.id))) {
    const n=board.byKey[`c:${p.position}`];
    if(!n)continue;
    if(p.id===activeOfficer&&targets.has(n.key)) {
      const target=inputItems.find(item=>item.key===n.key);
      target.radius=Math.max(target.radius,12);
    } else inputItems.push({...n,key:`officer:${p.id}`,officerId:p.id,radius:12,label:`${colorName[p.id.toLowerCase()]} 경찰 선택`});
  }
  const activate=item=>{if(disabled)return;setNearby([]);if(item.officerId)onSelectOfficer?.(item.officerId);else onPick(item.key);};
  const mapClick=e=>{
    if(disabled||moved.current||e.detail===0)return;
    const matrix=svgRef.current?.getScreenCTM();
    if(!matrix)return;
    const point=new window.DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
    const choices=mapHitChoices(inputItems,point,1/Math.hypot(matrix.a,matrix.b));
    if(choices.length===1)activate(choices[0]);else setNearby(choices);
  };
  const previewNodes=preview.map(key=>board.byKey[key]).filter(Boolean);
  const previewPath=previewNodes.length===2&&preview[0]?.startsWith('c:')?roadPath(board,previewNodes[0].id,previewNodes[1].id):previewNodes;
  return <Frame aria-label="사건 지도">
    <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} aria-label={game.gameType==='WHITEHALL'?'화이트홀 지도':'화이트채플 지도'}
      {...handlers} onClick={mapClick}>
      <defs><pattern id="case-paper" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M0 16h32M16 0v32" stroke={ink.road} strokeOpacity=".13" strokeWidth=".5"/></pattern><filter id="token-shadow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity=".25"/></filter></defs>
      <rect x="-500" y="-500" width={board.width+1000} height={board.height+1000} fill={ink.paper}/><rect width={board.width} height={board.height} fill="url(#case-paper)"/>
      {game.gameType==='WHITEHALL'&&<>{waterGroups.map((group,i)=><polyline key={i} points={group.map(id=>board.byKey[`n:${id}`]).map(n=>`${n.x},${n.y}`).join(' ')} stroke={ink.river} strokeWidth="32" strokeLinejoin="round" strokeLinecap="round" fill="none" opacity=".65"/>)}<path d="M600 20v1160M20 600h1160" stroke={ink.road} strokeDasharray="6 10" opacity=".5"/>{[['북서',40,45],['북동',1080,45],['남서',40,1170],['남동',1080,1170]].map(([t,x,y])=><text key={t} x={x} y={y} fontSize="18" fill={ink.water}>{t}</text>)}</>}
      <g stroke={ink.road} strokeWidth={game.gameType==='WHITEHALL'?5:3} strokeLinecap="round">{board.edges.map(([a,b],i)=>{const p=board.byId[a],q=board.byId[b];return p&&q?<line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y}/>:null;})}</g>
      <g stroke="#fffaf0" strokeWidth="1" strokeLinecap="round" opacity=".7">{board.edges.map(([a,b],i)=>{const p=board.byId[a],q=board.byId[b];return p&&q?<line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y}/>:null;})}</g>
      {route.length>1&&<polyline points={route.map(n=>board.byKey[`n:${n}`]).filter(Boolean).map(n=>`${n.x},${n.y}`).join(' ')} fill="none" stroke={ink.crime} strokeWidth="2" strokeDasharray="5 5" opacity=".65"/>}
      {previewPath.length>1&&<motion.polyline key={preview.join('-')} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:reduced?.01:.18}} points={previewPath.map(n=>`${n.x},${n.y}`).join(' ')} fill="none" stroke={ink.water} strokeWidth={3*screenUnit} strokeDasharray={`${6*screenUnit} ${4*screenUnit}`} pointerEvents="none"/>}
      {board.nodes.map(n=>{const location=n.kind==='location',active=targets.has(n.key)&&!disabled,selected=selectedKeys.includes(n.key),radius=location?(game.gameType==='WHITEHALL'?12:8):4;
        return <g key={n.key} transform={`translate(${n.x},${n.y})`} role={active?'button':undefined} tabIndex={active?0:undefined} aria-pressed={active?selected:undefined} aria-label={active?`${location?`장소 ${n.value}`:crossingLabel(game.gameType,n.value)} 선택`:undefined} onFocus={()=>{if(active)reveal(n.key);}} onKeyDown={e=>{if(active&&(e.key==='Enter'||e.key===' ')){e.preventDefault();setNearby([]);onPick(n.key);}}} style={{cursor:active?'pointer':'default'}}>
          {active&&<circle r={22*screenUnit} fill="transparent"/>}
          {active&&<circle r={patrolPoints.some(p=>p.key===n.key)?patrolHitRadius(n,patrolPoints,screenUnit):radius+5} fill={THEME.goldLight} fillOpacity={draftPatrols.length ? .3 : 1} stroke={ink.text} strokeWidth="1"/>}
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
      {draftPatrols.map(p=>{const n=board.byKey[`c:${p.position}`];return n?<g key={`draft-${p.position}`} transform={`translate(${n.x},${n.y})`} pointerEvents="none"><rect x={-19*screenUnit} y={-11*screenUnit} width={38*screenUnit} height={22*screenUnit} rx={4*screenUnit} fill={ink[p.officerId]??ink.paper} stroke={ink.text} strokeWidth={screenUnit}/><text textAnchor="middle" dominantBaseline="central" fill={p.officerId?'#fff':ink.text} fontSize={12*screenUnit} fontWeight="700">{colorName[p.officerId]??'가짜'}</text></g>:null;})}
      {!draftPatrols.length&&patrols.map(p=>{const n=board.byKey[`c:${p.position}`],known=p.revealed||p.known;return n?<g key={p.position} transform={`translate(${n.x},${n.y})`} pointerEvents="none"><rect x="-7" y="-7" width="14" height="14" rx="2" fill={known&&p.officerId?ink[p.officerId]:ink.text} stroke={THEME.gold}/><text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="10">{known?(p.officerId?'●':'×'):'?'}</text>{known&&<text y="19" textAnchor="middle" fill={ink.text} fontSize="8">{p.officerId?colorName[p.officerId]:'가짜'}</text>}</g>:null;})}
      {visiblePolice.map(p=>{const n=board.byKey[`c:${p.position}`];if(!n)return null;const path=moving[p.id]??[],c=p.id.toLowerCase();return <motion.g key={p.id} initial={false} animate={{x:!reduced&&path.length>1?path.map(q=>q.x):n.x,y:!reduced&&path.length>1?path.map(q=>q.y):n.y}} transition={{duration:reduced ? .01 : .65,ease:'easeInOut'}} pointerEvents="none" filter="url(#token-shadow)"><path d="M-7 8L-5 -3Q-9 -12 0 -12Q9 -12 5 -3L7 8Z" fill={ink[c]} stroke="#fff" strokeWidth="1.5"/><text y="20" textAnchor="middle" fontSize="8" fill={ink.text}>{colorName[c]}</text></motion.g>;})}
      {jack&&<motion.g initial={false} animate={{x:!reduced&&jackPath.length>1?[null,...jackPath.map(n=>n.x)]:jack.x,y:!reduced&&jackPath.length>1?[null,...jackPath.map(n=>n.y)]:jack.y}} transition={{duration:reduced ? .01 : .65}} pointerEvents="none"><path d="M-8 8L-5 -5H5L8 8Z M-9 -5H9 M-4 -5V-10H4V-5" fill={ink.text} stroke={ink.crime} strokeWidth="1.5"/><text y="22" textAnchor="middle" fontSize="9" fill={ink.crime}>잭 · 나만 보임</text></motion.g>}
      {feedback.map((e,i)=>{const n=board.byKey[`n:${e.location??e.to}`];if(!n)return null;const hit=e.found||e.caught||e.type==='DISCOVERY_REVEALED';return <motion.g key={`${batchId}-${i}`} initial={{opacity:0}} animate={{opacity:[0,1,1]}} transition={{duration:reduced?.1:.65}} pointerEvents="none"><circle cx={n.x} cy={n.y} r="20" fill={hit?THEME.goldLight:'#fffdf5'} fillOpacity=".8" stroke={hit?ink.crime:ink.text} strokeWidth="2"/><text x={n.x} y={n.y} dominantBaseline="central" textAnchor="middle" fontSize="16" fill={ink.text}>{hit?'!':'×'}</text></motion.g>;})}
      {visiblePolice.filter(p=>selectableOfficers.includes(p.id)).map(p=>{
        const n=board.byKey[`c:${p.position}`];if(!n)return null;
        const stay=activeOfficer===p.id&&targets.has(n.key);
        return <g key={`select-${p.id}`} transform={`translate(${n.x},${n.y})`} role="button" tabIndex={disabled?-1:0} aria-label={`${colorName[p.id.toLowerCase()]} 경찰 ${stay?'현재 위치 선택':'선택'}`} aria-pressed={stay?selectedKeys.includes(n.key):activeOfficer===p.id} onFocus={()=>reveal(n.key)} onKeyDown={e=>{if(!disabled&&(e.key==='Enter'||e.key===' ')){e.preventDefault();activate(stay?{key:n.key}:{officerId:p.id});}}} style={{cursor:disabled?'default':'pointer'}}>
          <circle r={22*screenUnit} fill="transparent"/>
          {activeOfficer===p.id&&<><circle r={12*screenUnit} fill="none" stroke={ink.text} strokeWidth={2*screenUnit} strokeDasharray={`${3*screenUnit} ${3*screenUnit}`} pointerEvents="none"/><text y={-16*screenUnit} textAnchor="middle" fontSize={12*screenUnit} fill={ink.text} pointerEvents="none">선택</text></>}
        </g>;
      })}
    </svg>
    {nearby.length>1&&<Nearby aria-label="가까운 지도 대상"><strong role="status">가까운 대상 {nearby.length}곳 · 하나를 고르세요</strong><button onClick={()=>setNearby([])} aria-label="가까운 대상 닫기">닫기</button><div className="choices">{nearby.map(item=><button key={item.key} aria-pressed={!item.officerId&&selectedKeys.includes(item.key)} onClick={()=>activate(item)}>{item.label}</button>)}</div></Nearby>}
    <Tools aria-label="지도 조작"><button onClick={()=>zoom(.7)} aria-label="지도 확대">＋</button><button onClick={()=>zoom(1.4)} aria-label="지도 축소">−</button><button onClick={fit}>전체 지도</button><button onClick={()=>focus(focusKey??(jack?jack.key:null)??`c:${game.police?.[game.pawnIndex??0]?.position}`)}>현재 말</button></Tools>
    <Compass>북<br/>↑<br/>N</Compass><Legend>번호: 잭 이동 · 교차로: 수사관 · 금색 점: 흔적<br/>지도를 끌어 이동 · ＋로 확대</Legend>
  </Frame>;
}
