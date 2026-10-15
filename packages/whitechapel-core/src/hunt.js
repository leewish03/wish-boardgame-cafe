import { jackDestinations, alleyDestinations, policeDestinations, inspectableNumbers, redNumbers } from './map.js';
import { requireRule as check, jackMoves, currentPolice, beginPolice, finish } from './state.js';
function completeOfficer(s,id) {
  s.pendingPolice=s.pendingPolice.filter(n=>n!==id);
  if (!s.pendingPolice.length) {
    if (s.playPhase==='POLICE_MOVE') beginPolice(s,'POLICE_ACTION');
    else s.playPhase='JACK_MOVE';
  }
}
function officer(s,c,phase) {
  check(s.playPhase===phase, '경찰 행동 차례가 아닙니다.');
  const p=currentPolice(s).find(p=>p.id===c.officerId && p.ownerId===c.playerId);
  check(p, '현재 차례의 경찰을 선택해 주세요.');
  return p;
}
export const huntHandlers={
  JACK_MOVE(s,c) {
    check(s.playPhase==='JACK_MOVE' && c.playerId===s.jackPlayerId, '잭의 이동 차례가 아닙니다.');
    const mode=c.mode||'normal';
    check(jackMoves(s).some(m=>m.mode===mode && m.to===c.to && m.via===c.via), '이동할 수 없는 경로입니다.');
    check(c.escape===undefined || typeof c.escape==='boolean', '탈출 선언 여부를 확인해 주세요.');
    const canEscape=mode==='normal' && c.to===s.hideout;
    check(c.escape!==true || canEscape, '은신처로 일반 이동할 때만 탈출을 선언할 수 있습니다.');
    const blocked=s.police.map(p=>p.position);
    s.beliefs=[...new Set(s.beliefs.flatMap(n=> {
      if (mode==='normal') return jackDestinations(n,blocked);
      if (mode==='alley') return alleyDestinations(n);
      return jackDestinations(n).flatMap(via=>jackDestinations(via).filter(to=>to!==n && to!==via));
    }))];
    if (mode==='coach') s.trail.push(c.via);
    s.trail.push(c.to); s.position=c.to; s.track+=mode==='coach'?2:1;
    if (mode!=='normal') s.specials[mode]--;
    s.movementHistory.push({mode,track:s.track});
    (s.huntHistory??=[]).push({type:'JACK_MOVED',mode,blockedCrossings:blocked});
    const events=[{type:'JACK_MOVED',mode,track:s.track}];
    if (canEscape && c.escape!==false) {
      s.escapedBeliefs=s.beliefs.filter(n=>!redNumbers.includes(n)&&(!s.escapedBeliefs||s.escapedBeliefs.includes(n)));
      s.completedNights++; s.clues=[];
      if (s.roundNumber===4) finish(s,'JACK','FOUR_ESCAPES');
      else { s.matchState='ROUND_END'; s.playPhase='NIGHT_END'; }
      events.push({type:'JACK_ESCAPED',night:s.roundNumber});
    } else if (s.track>=15) finish(s,'POLICE','TIME_EXPIRED');
    else beginPolice(s,'POLICE_MOVE');
    return events;
  },
  POLICE_MOVE(s,c) {
    const p=officer(s,c,'POLICE_MOVE');
    check(policeDestinations(p.position,s.police.map(p=>p.position)).includes(c.to), '경찰이 이동할 수 없는 교차로입니다.');
    const from=p.position; p.position=c.to; completeOfficer(s,p.id);
    return [{type:'POLICE_MOVED',officerId:p.id,from,to:c.to}];
  },
  SEARCH(s,c) {
    const p=officer(s,c,'POLICE_ACTION');
    const adjacent=inspectableNumbers(p.position);
    check(adjacent.includes(c.to) && !(s.searched[p.id]||[]).includes(c.to), '조사할 수 없는 장소입니다.');
    s.actionMode[p.id]='SEARCH'; (s.searched[p.id]??=[]).push(c.to);
    const found=s.trail.includes(c.to);
    if (found && !s.clues.includes(c.to)) s.clues.push(c.to);
    s.searches.push({officerId:p.id,to:c.to,found,track:s.track});
    (s.huntHistory??=[]).push({type:'CLUE_SEARCHED',location:c.to,found});
    if (!found) s.beliefs=s.beliefs.filter(n=>n!==c.to);
    if (found || s.searched[p.id].length===adjacent.length) completeOfficer(s,p.id);
    return [{type:'CLUE_SEARCHED',officerId:p.id,to:c.to,found}];
  },
  ARREST(s,c) {
    const p=officer(s,c,'POLICE_ACTION');
    check(!s.actionMode[p.id] && inspectableNumbers(p.position).includes(c.to), '체포를 시도할 수 없는 장소입니다.');
    const caught=s.position===c.to;
    (s.huntHistory??=[]).push({type:'ARREST_ATTEMPTED',location:c.to,found:caught});
    if (caught) finish(s,'POLICE','ARREST');
    else { s.beliefs=s.beliefs.filter(n=>n!==c.to); completeOfficer(s,p.id); }
    return [{type:'ARREST_ATTEMPTED',officerId:p.id,to:c.to,caught}];
  },
  PASS(s,c) {
    const p=officer(s,c,'POLICE_ACTION');
    check(!s.actionMode[p.id], '시작한 수색을 마쳐 주세요.');
    completeOfficer(s,p.id); return [{type:'POLICE_PASSED',officerId:p.id}];
  },
};
