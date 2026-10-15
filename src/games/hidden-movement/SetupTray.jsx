import React from 'react';
import { boards, colorName, crossingLabel } from './model';

export function setupTargets(game, secret, draft) {
  const legal=secret?.legal??{}, board=boards[game.gameType];
  if(legal.discoveryQuadrants) return new Set(board.nodes.filter(n=>n.kind==='location'&&n.color==='white').map(n=>n.key));
  if(legal.womanNumbers) return new Set(legal.womanNumbers.map(n=>`n:${n}`));
  if(legal.patrolStarts) return new Set([...new Set([...legal.patrolRequired,...legal.patrolStarts])].map(n=>`c:${n}`));
  return null;
}

export function updateSetup(game, secret, draft, key) {
  const legal=secret.legal, node=boards[game.gameType].byKey[key], values=draft.values??[];
  if(legal.discoveryQuadrants) {
    const next=values.filter(n=>boards.WHITEHALL.byKey[`n:${n}`].quadrant!==node.quadrant);
    return {...draft,values:values.includes(node.value)?next:[...next,node.value]};
  }
  if(legal.womanNumbers) {
    const next=values.includes(node.value)?values.filter(n=>n!==node.value):values.length<legal.women?[...values,node.value]:values;
    return {...draft,values:next,real:(draft.real??[]).filter(n=>next.includes(n))};
  }
  if(legal.patrolStarts) {
    if(legal.patrolRequired.includes(node.value))return draft;
    const next=values.includes(node.value)?values.filter(n=>n!==node.value):values.length<7?[...values,node.value]:values;
    return {...draft,values:next};
  }
  return draft;
}

export function initialDraft(secret) {
  const l=secret?.legal??{};
  return {values:l.patrolRequired?[...new Set(l.patrolRequired)]:[],real:[],assignments:{}};
}

export default function SetupTray({game,secret,draft,setDraft,send,disabled,Button,Row}) {
  const l=secret.legal, values=draft.values??[], board=boards[game.gameType];
  if(l.discoveryQuadrants) return <>
    <Row>{[['NW','북서'],['NE','북동'],['SW','남서'],['SE','남동']].map(([q,label])=><label key={q}>{label} <select aria-label={`${label} 비밀 목적지`} disabled={disabled} value={values.find(n=>board.byKey[`n:${n}`].quadrant===q)??''} onChange={e=>{if(e.target.value)setDraft(updateSetup(game,secret,draft,`n:${e.target.value}`));}}><option value="">선택</option>{board.nodes.filter(n=>n.kind==='location'&&n.color==='white'&&n.quadrant===q).map(n=><option key={n.value} value={n.value}>{n.value}번</option>)}</select></label>)}</Row>
    <Button disabled={disabled||values.length!==4} onClick={()=>send({type:'SET_DISCOVERIES',locations:values})}>비밀 목적지 4곳 확정</Button>
  </>;
  if(l.womanNumbers) return <>
    <p>배치 {values.length}/{l.women} · 실제 여성 {(draft.real??[]).length}/{l.real}</p>
    <Row>{l.womanNumbers.map(n=><Button key={n} $active={values.includes(n)} aria-pressed={values.includes(n)} disabled={disabled} onClick={()=>setDraft(updateSetup(game,secret,draft,`n:${n}`))}>{n}번 {values.includes(n)?'✓':''}</Button>)}</Row>
    {values.length===l.women&&<><p>실제 여성 토큰을 선택하세요. 선택하지 않은 토큰은 가짜입니다.</p><Row>{values.map(n=><Button key={n} $active={draft.real.includes(n)} aria-pressed={draft.real.includes(n)} disabled={disabled} onClick={()=>setDraft({...draft,real:draft.real.includes(n)?draft.real.filter(x=>x!==n):draft.real.length<l.real?[...draft.real,n]:draft.real})}>{n}번 · {draft.real.includes(n)?'실제':'가짜'}</Button>)}</Row></>}
    <Button disabled={disabled||values.length!==l.women||draft.real.length!==l.real} onClick={()=>send({type:'PLACE_WOMEN',positions:values,real:draft.real})}>여성 토큰 배치 확정</Button>
  </>;
  if(l.patrolStarts) {
    const choices=[...new Set([...l.patrolRequired,...l.patrolStarts])], assigned=values.map(n=>draft.assignments[n]??''), real=assigned.filter(Boolean);
    const valid=values.length===7&&real.length===5&&new Set(real).size===5;
    return <><p>교차로 {values.length}/7 · 경찰 5명 + 가짜 2개</p><Row>{choices.map(n=><Button key={n} $active={values.includes(n)} disabled={disabled||l.patrolRequired.includes(n)} aria-pressed={values.includes(n)} onClick={()=>setDraft(updateSetup(game,secret,draft,`c:${n}`))}>{crossingLabel(game.gameType,n)} {l.patrolRequired.includes(n)?'유지':values.includes(n)?'✓':''}</Button>)}</Row>
      {values.map(n=><label key={n} style={{display:'flex',gap:8,alignItems:'center',justifyContent:'space-between',margin:'6px 0'}}>{crossingLabel(game.gameType,n)}<select aria-label={`${crossingLabel(game.gameType,n)} 순찰 배정`} value={draft.assignments[n]??''} disabled={disabled} onChange={e=>setDraft({...draft,assignments:{...draft.assignments,[n]:e.target.value}})}><option value="">가짜 순찰</option>{l.colors.map(c=><option key={c} value={c}>{colorName[c]} 경찰</option>)}</select></label>)}
      <Button disabled={disabled||!valid} onClick={()=>send({type:'PLACE_PATROLS',patrols:values.map(position=>({position,officerId:draft.assignments[position]||null}))})}>비밀 순찰 배치 확정</Button>
    </>;
  }
  return null;
}
