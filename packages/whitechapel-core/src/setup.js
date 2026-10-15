import { numbers, redNumbers, policeStarts } from './map.js';
import { requireRule as check, colors, nightRules, prepareNight, beginPolice, wretchedMoves } from './state.js';
export const setupHandlers = {
  CHOOSE_HIDEOUT(s,c) {
    check(s.playPhase === 'CHOOSE_HIDEOUT' && c.playerId === s.jackPlayerId, '은신처를 선택할 차례가 아닙니다.');
    check(numbers.includes(c.to) && !redNumbers.includes(c.to), '붉은 장소는 은신처가 될 수 없습니다.');
    s.hideout = c.to; prepareNight(s);
    return [{type:'NIGHT_STARTED',night:s.roundNumber}];
  },
  PLACE_WOMEN(s,c) {
    check(s.playPhase === 'PLACE_WOMEN' && c.playerId === s.jackPlayerId, '여성을 배치할 차례가 아닙니다.');
    const rule = nightRules[s.roundNumber-1];
    check(Array.isArray(c.positions) && c.positions.length === rule.women && new Set(c.positions).size === rule.women && c.positions.every(n => redNumbers.includes(n) && !s.crimeScenes.includes(n)), '여성의 배치 장소를 확인해 주세요.');
    check(Array.isArray(c.real) && c.real.length === rule.real && new Set(c.real).size === rule.real && c.real.every(n => c.positions.includes(n)), '실제 피해자 수를 확인해 주세요.');
    s.women = c.positions.map(position => ({position,real:c.real.includes(position)})); s.playPhase = 'PLACE_PATROLS';
    return [{type:'WOMEN_PLACED',positions:[...c.positions].sort((a,b)=>a-b)}];
  },
  PLACE_PATROLS(s,c) {
    check(s.playPhase === 'PLACE_PATROLS' && c.playerId === s.headPlayerId, '수사 책임자만 순찰을 배치할 수 있습니다.');
    check(Array.isArray(c.patrols) && c.patrols.length === 7, '순찰 토큰 7개를 배치해 주세요.');
    const positions = c.patrols.map(p=>p.position);
    const assigned = c.patrols.map(p=>p.officerId).filter(id=>id !== null);
    check(new Set(positions).size === 7 && assigned.length === 5 && new Set(assigned).size === 5 && assigned.every(id=>colors.includes(id)), '각 경찰과 가짜 순찰 2개가 필요합니다.');
    const previous = s.roundNumber === 1 ? [] : s.police.map(p=>p.position);
    check(previous.every(n=>positions.includes(n)) && positions.every(n=>previous.includes(n)||policeStarts.includes(n)), '이전 경찰 위치와 노란 교차로에 배치해 주세요.');
    s.patrols = c.patrols.map(p=>({position:p.position,officerId:p.officerId,revealed:false}));
    s.wretched = s.women.filter(w=>w.real).map(w=>w.position); s.women = []; s.playPhase='KILL_OR_WAIT';
    return [{type:'PATROLS_PLACED',positions:positions.sort((a,b)=>a-b)},{type:'VICTIMS_REVEALED',positions:[...s.wretched]}];
  },
  WAIT(s,c) {
    check(s.playPhase==='KILL_OR_WAIT' && c.playerId===s.jackPlayerId && s.wait<5, '더 기다릴 수 없습니다.');
    s.wait++; s.pendingWretched=[...s.wretched]; s.playPhase='MOVE_WRETCHED';
    return [{type:'TIME_ADVANCED',wait:s.wait}];
  },
  MOVE_WRETCHED(s,c) {
    check(s.playPhase==='MOVE_WRETCHED' && c.playerId===s.headPlayerId && s.pendingWretched.includes(c.from), '이 여성을 이동할 수 없습니다.');
    check(wretchedMoves(s,c.from).includes(c.to), '여성이 이동할 수 없는 장소입니다.');
    s.wretched[s.wretched.indexOf(c.from)]=c.to; s.pendingWretched=s.pendingWretched.filter(n=>n!==c.from);
    if (!s.pendingWretched.length) s.playPhase='REVEAL_PATROL';
    return [{type:'WRETCHED_MOVED',from:c.from,to:c.to}];
  },
  REVEAL_PATROL(s,c) {
    check(s.playPhase==='REVEAL_PATROL' && c.playerId===s.jackPlayerId, '순찰을 공개할 차례가 아닙니다.');
    const patrol=s.patrols.find(p=>p.position===c.position && !p.revealed);
    check(patrol, '공개하지 않은 순찰을 선택해 주세요.');
    patrol.revealed=true;
    if (patrol.officerId===null) s.patrols=s.patrols.filter(p=>p!==patrol);
    s.playPhase='KILL_OR_WAIT';
    return [{type:'PATROL_REVEALED',position:patrol.position,officerId:patrol.officerId}];
  },
  MURDER(s,c) {
    check(s.playPhase==='KILL_OR_WAIT' && c.playerId===s.jackPlayerId, '범행을 선택할 차례가 아닙니다.');
    const count=s.roundNumber===3?2:1;
    check(Array.isArray(c.victims) && c.victims.length===count && new Set(c.victims).size===count && c.victims.every(n=>s.wretched.includes(n)), '피해자를 선택해 주세요.');
    s.trail=[...c.victims]; s.position=c.victims.at(-1); s.track=1-s.wait+count-1;
    const sites=[...c.victims].sort((a,b)=>a-b);
    s.crimeScenes.push(...sites); s.nightCrimes=sites; s.wretched=[];
    for (const p of s.police) p.position=s.patrols.find(t=>t.officerId===p.id).position;
    s.patrols=[]; s.beliefs=[...sites];
    if (count===2) beginPolice(s,'POLICE_MOVE'); else s.playPhase='JACK_MOVE';
    return [{type:'CRIME_DISCOVERED',positions:sites},{type:'POLICE_DEPLOYED',officers:s.police.map(p=>({...p}))}];
  },
};
