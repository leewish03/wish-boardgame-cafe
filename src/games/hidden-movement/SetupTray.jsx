import React from 'react';
import { boards, colorName, crossingLabel, initialSetupDraft, placePatrol } from './model';

export function setupTargets(game, secret, draft) {
  const legal=secret?.legal??{}, board=boards[game.gameType];
  if(legal.discoveryQuadrants) return new Set(board.nodes.filter(n=>n.kind==='location'&&n.color==='white').map(n=>n.key));
  if(legal.womanNumbers) return new Set(legal.womanNumbers.map(n=>`n:${n}`));
  if(legal.patrolStarts) return new Set((draft.values?.length===7&&!draft.editPositions?draft.values:[...new Set([...legal.patrolRequired,...legal.patrolStarts])]).map(n=>`c:${n}`));
  return null;
}

export function updateSetup(game, secret, draft, key) {
  const legal=secret.legal, node=boards[game.gameType].byKey[key], values=draft.values??[];
  if(legal.discoveryQuadrants) {
    const next=values.filter(n=>boards.WHITEHALL.byKey[`n:${n}`].quadrant!==node.quadrant);
    return {...draft,values:values.includes(node.value)?next:[...next,node.value]};
  }
  if(legal.womanNumbers) {
    if(legal.womanNumbers.length===legal.women) {
      const real=draft.real??[];
      return {...draft,real:real.includes(node.value)?real.filter(n=>n!==node.value):real.length<legal.real?[...real,node.value]:real};
    }
    const next=values.includes(node.value)?values.filter(n=>n!==node.value):values.length<legal.women?[...values,node.value]:values;
    return {...draft,values:next,real:(draft.real??[]).filter(n=>next.includes(n))};
  }
  if(legal.patrolStarts) {
    if(values.length===7&&!draft.editPositions) return placePatrol(draft,node.value,draft.patrolColor??legal.colors[0]);
    if(legal.patrolRequired.includes(node.value))return draft;
    const next=values.includes(node.value)?values.filter(n=>n!==node.value):values.length<7?[...values,node.value]:values;
    return {...draft,values:next,assignments:Object.fromEntries(Object.entries(draft.assignments).filter(([position])=>next.some(n=>String(n)===position)))};
  }
  return draft;
}

export function initialDraft(secret) {
  return initialSetupDraft(secret);
}

export default function SetupTray({game,secret,draft,setDraft,disabled,Button,Row}) {
  const l=secret.legal, values=draft.values??[], board=boards[game.gameType];
  if(l.discoveryQuadrants) return <>
    <Row>{[['NW','북서'],['NE','북동'],['SW','남서'],['SE','남동']].map(([q,label])=><label key={q}>{label} <select aria-label={`${label} 비밀 목적지`} disabled={disabled} value={values.find(n=>board.byKey[`n:${n}`].quadrant===q)??''} onChange={e=>{if(e.target.value)setDraft(updateSetup(game,secret,draft,`n:${e.target.value}`));}}><option value="">선택</option>{board.nodes.filter(n=>n.kind==='location'&&n.color==='white'&&n.quadrant===q).map(n=><option key={n.value} value={n.value}>{n.value}번</option>)}</select></label>)}</Row>
  </>;
  if(l.womanNumbers) return <>
    <p>배치 {values.length}/{l.women} · 실제 여성 {(draft.real??[]).length}/{l.real}</p>
    {l.womanNumbers.length!==l.women&&<Row>{l.womanNumbers.map(n=><Button key={n} $active={values.includes(n)} aria-pressed={values.includes(n)} disabled={disabled} onClick={()=>setDraft(updateSetup(game,secret,draft,`n:${n}`))}>{n}번 {values.includes(n)?'✓':''}</Button>)}</Row>}
    {values.length===l.women&&<><p>실제 여성 토큰을 선택하세요. 선택하지 않은 토큰은 가짜입니다.</p><Row>{values.map(n=><Button key={n} $active={draft.real.includes(n)} aria-pressed={draft.real.includes(n)} disabled={disabled} onClick={()=>setDraft({...draft,real:draft.real.includes(n)?draft.real.filter(x=>x!==n):draft.real.length<l.real?[...draft.real,n]:draft.real})}>{n}번 · {draft.real.includes(n)?'실제':'가짜'}</Button>)}</Row></>}
  </>;
  if(l.patrolStarts) {
    const choices=[...new Set([...l.patrolRequired,...l.patrolStarts])];
    const placing=values.length===7&&!draft.editPositions, active=draft.patrolColor??l.colors[0];
    const assigned=l.colors.filter(c=>Object.values(draft.assignments).includes(c));
    return placing?<>
      <Row role="group" aria-label="배치할 경찰" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(44px,1fr))',gap:4}}>{l.colors.map(c=><Button key={c} style={{padding:'6px 2px'}} $active={active===c} aria-pressed={active===c} disabled={disabled} onClick={()=>setDraft({...draft,patrolColor:c})}>{colorName[c]}<br/><small>{assigned.includes(c)?'배치됨':'미배치'}</small></Button>)}</Row>
      <p>{colorName[active]} 경찰 → 지도에서 순찰 지점 선택 · {assigned.length}/5명</p>
      <details><summary>순찰 지점 목록 · 빈 2곳은 가짜</summary><Row>{values.map(n=><Button key={n} $active={draft.assignments[n]===active} disabled={disabled} onClick={()=>setDraft(placePatrol(draft,n,active))}>{crossingLabel(game.gameType,n)} · {colorName[draft.assignments[n]]??'가짜'}</Button>)}</Row></details>
      {choices.length>7&&<Button disabled={disabled} onClick={()=>setDraft({...draft,editPositions:true})}>순찰 지점 변경</Button>}
    </>:<><p>순찰 지점 {values.length}/7</p><Row>{choices.map(n=><Button key={n} $active={values.includes(n)} disabled={disabled||l.patrolRequired.includes(n)} aria-pressed={values.includes(n)} onClick={()=>setDraft(updateSetup(game,secret,draft,`c:${n}`))}>{crossingLabel(game.gameType,n)} {l.patrolRequired.includes(n)?'유지':values.includes(n)?'✓':''}</Button>)}</Row>{values.length===7&&<Button disabled={disabled} onClick={()=>setDraft({...draft,editPositions:false})}>경찰 배치로</Button>}</>;
  }
  return null;
}
