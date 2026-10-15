import * as chapel from '../../../packages/whitechapel-core/src/map.js';
import * as hall from '../../../packages/whitehall-core/src/map.js';

export const ink = { paper: '#efe5cf', text: '#302b24', road: '#a99a7d', river: '#b9cdd0', water: '#315c64', crime: '#8c3439', blue: '#345d8e', yellow: '#a27b24', red: '#a93e3e', brown: '#79573b', green: '#417254' };
export const colorName = { blue: '파랑', yellow: '노랑', red: '빨강', brown: '갈색', green: '초록' };
export const modeName = { normal: '도보', WALK: '도보', coach: '마차', COACH: '마차', alley: '골목', ALLEY: '골목', BOAT: '배' };
const chapelNodes = chapel.nodes.map(n => ({ ...n, key: `${n.kind === 'location' ? 'n' : 'c'}:${n.kind === 'location' ? n.number : n.id}`, value: n.kind === 'location' ? n.number : n.id }));
const hallNodes = [...hall.circles.map(n => ({ ...n, kind: 'location', value: n.id, number: n.id, key: `n:${n.id}` })), ...hall.crossings.map(n => ({ ...n, kind: 'crossing', value: n.id, key: `c:${n.id}`, isPoliceStart: n.starting }))];
function board(nodes, edges, width, height) {
  return { nodes, edges, width, height, byKey: Object.fromEntries(nodes.map(n => [n.key, n])), byId: Object.fromEntries(nodes.map(n => [n.id, n])) };
}
export const boards = {
  WHITECHAPEL: board(chapelNodes, chapel.nodes.flatMap(n => n.adjacent.filter(id => id > n.id).map(id => [n.id, id])), 1000, 680),
  WHITEHALL: board(hallNodes, hall.edges, 1200, 1200),
};
export const waterGroups = hall.waterGroups;
const crossingLabels=Object.fromEntries(Object.entries(boards).map(([type,map])=>{
  const locations=map.nodes.filter(n=>n.kind==='location');
  const entries=map.nodes.filter(n=>n.kind==='crossing').map(point=>({id:point.value,count:2,near:[...locations].sort((a,b)=>(a.x-point.x)**2+(a.y-point.y)**2-((b.x-point.x)**2+(b.y-point.y)**2)||a.number-b.number).map(n=>n.number)}));
  for(let depth=2;depth<locations.length;depth++){
    const groups=new Map();
    for(const entry of entries){const key=entry.near.slice(0,entry.count).join('·');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);}
    const duplicates=[...groups.values()].filter(group=>group.length>1);
    if(!duplicates.length)break;
    for(const group of duplicates)for(const entry of group)entry.count++;
  }
  return [type,Object.fromEntries(entries.map(entry=>[entry.id,`${entry.near.slice(0,entry.count).join('·')}번 옆 교차로`]))];
}));
export function crossingLabel(gameType, id) {
  return crossingLabels[gameType]?.[id]??'교차로';
}
export const phaseNames = { CHOOSE_HIDEOUT: '비밀 은신처 선택', PLACE_WOMEN: '여성 토큰 배치', PLACE_PATROLS: '비밀 순찰 배치', KILL_OR_WAIT: '범행 또는 기다리기', MOVE_WRETCHED: '여성 이동', REVEAL_PATROL: '순찰 공개', SET_DISCOVERIES: '비밀 목적지 선택', DEPLOY: '수사관 배치', CHOOSE_START: '출발지 공개', JACK_MOVE: '잭의 이동', POLICE_MOVE: '수사관 이동', POLICE_ACTION: '수색 또는 체포', RESOLVE_TURN: '발견 장소 확인', NIGHT_END: '밤의 종료', FINISHED: '사건 종료', GAME_OVER: '사건 종료', LOBBY: '사건 준비' };
export const phaseHelp = { CHOOSE_HIDEOUT: '붉은 장소를 제외한 번호 하나를 선택하세요. 네 번의 밤 모두 이곳으로 돌아와야 합니다.', PLACE_WOMEN: '장소를 먼저 고른 뒤 실제 여성 토큰을 지정하세요. 나머지는 가짜 토큰입니다.', PLACE_PATROLS: '교차로 7곳에 경찰 5명과 가짜 순찰 2개를 배치하세요. 배치는 잭에게 숨겨집니다.', KILL_OR_WAIT: '기다리면 도주 시간이 늘지만 여성과 순찰의 상황도 바뀝니다.', MOVE_WRETCHED: '여성을 선택하고 이동할 번호를 고르세요. 모든 여성을 한 번씩 이동합니다.', REVEAL_PATROL: '뒷면 순찰 하나를 골라 정체를 확인하세요.', SET_DISCOVERIES: '네 구역에서 흰색 장소를 하나씩 고르세요. 나머지 세 곳은 수사관에게 비밀입니다.', DEPLOY: '노란 시작 교차로에 수사관을 배치하세요.', CHOOSE_START: '네 목적지 중 공개할 출발지를 고르세요.', JACK_MOVE: '지도에서 이동할 번호를 선택하세요. 마차는 두 칸, 골목과 배는 한 칸을 사용합니다.', POLICE_MOVE: '교차로를 최대 두 칸 이동하거나 현재 위치에 머무를 수 있습니다.', POLICE_ACTION: '수색은 이번 경로의 흔적, 체포는 잭의 현재 위치를 확인합니다. 수색을 시작하면 체포할 수 없습니다.', RESOLVE_TURN: '수사관 행동이 끝나면 잭의 도착 여부를 확인합니다.' };

export function legalCommands(game, secret) {
  const l = secret?.legal ?? {};
  if (game.gameType === 'WHITECHAPEL') return l.commands ?? [];
  const cmds = [];
  if (l.startLocations) cmds.push(...l.startLocations.map(to => ({ type: 'CHOOSE_START', to })));
  if (l.destinations) cmds.push(...l.destinations.map(to => ({ type: game.playPhase, pawnId: l.pawnId, to })));
  if (l.moves) cmds.push(...l.moves.map(move => ({ type: 'JACK_MOVE', ...move })));
  if (l.searchTargets) cmds.push(...l.searchTargets.map(to => ({ type: 'SEARCH', pawnId: l.pawnId, to })));
  if (l.arrestTargets) cmds.push(...l.arrestTargets.map(to => ({ type: 'ARREST', pawnId: l.pawnId, to })));
  if (l.canEnd) cmds.push({ type: 'END_ACTION', pawnId: l.pawnId });
  return cmds;
}
export function commandTarget(c) {
  if (!c) return null;
  const value = c.path?.at(-1) ?? c.to ?? c.position ?? c.victims?.at(-1);
  return value == null ? null : `${['POLICE_MOVE', 'DEPLOY', 'REVEAL_PATROL'].includes(c.type) ? 'c' : 'n'}:${value}`;
}
export function publicEventTarget(events) {
  const event=events.find(e=>['POLICE_MOVED','CLUE_SEARCHED','ARREST_ATTEMPTED','WRETCHED_MOVED','DISCOVERY_REVEALED','CRIME_DISCOVERED','PATROL_REVEALED'].includes(e.type));
  if(!event)return null;
  const value=event.location??event.to??event.position??event.positions?.at(-1);
  return value==null?null:`${['POLICE_MOVED','PATROL_REVEALED'].includes(event.type)?'c':'n'}:${value}`;
}
export function mapFocusView(board, keys) {
  const points=keys.map(key=>board.byKey[key]).filter(Boolean);
  if(!points.length)return null;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  const w=Math.max(right-left+board.width*.25,(bottom-top+board.height*.25)*board.width/board.height);
  const h=w*board.height/board.width;
  return {x:(left+right-w)/2,y:(top+bottom-h)/2,w,h};
}
export function commandLabel(c, gameType='WHITECHAPEL') {
  const officer = c.officerId ?? c.pawnId;
  const prefix = officer ? `${colorName[officer.toLowerCase()] ?? officer} ` : '';
  switch (c.type) {
    case 'CHOOSE_HIDEOUT': return `${c.to}번 은신처`;
    case 'CHOOSE_START': return `${c.to}번에서 출발`;
    case 'JACK_MOVE': return `${modeName[c.mode]} · ${c.path?.join(' → ') ?? [c.via, c.to].filter(n => n != null).join(' → ')}번`;
    case 'POLICE_MOVE': return `${prefix}${crossingLabel(gameType,c.to)}`;
    case 'DEPLOY': return `${prefix}${crossingLabel(gameType,c.to)} 배치`;
    case 'SEARCH': return `${prefix}${c.to}번 수색`;
    case 'ARREST': return `${prefix}${c.to}번 체포`;
    case 'MOVE_WRETCHED': return `${c.from} → ${c.to}번`;
    case 'REVEAL_PATROL': return `${crossingLabel(gameType,c.position)} 순찰 공개`;
    case 'MURDER': return `${c.victims.join(' → ')}번 범행`;
    case 'WAIT': return '한 시간 기다리기';
    case 'PASS': case 'END_ACTION': return `${prefix}조사 마치기`;
    case 'ADVANCE_ROUND': return '다음 밤 시작';
    default: return '게임 시작';
  }
}
export function eventLabel(e, gameType='WHITECHAPEL') {
  const who = colorName[(e.officerId ?? e.pawnId ?? '').toLowerCase()] ?? '수사관';
  switch (e.type) {
    case 'MATCH_STARTED': return '새 사건 · 각자의 준비를 시작합니다';
    case 'DISCOVERIES_CHOSEN': return '잭의 비밀 목적지 선택 완료';
    case 'POLICE_MOVED': return `${who} 수사관 · ${crossingLabel(gameType,e.to)} 이동`;
    case 'CLUE_SEARCHED': return `${e.location ?? e.to}번 수색 · ${e.found ? '흔적 발견' : '흔적 없음'}`;
    case 'ARREST_ATTEMPTED': return `${e.location ?? e.to}번 체포 · ${e.found || e.caught ? '잭 검거' : '잭이 없습니다'}`;
    case 'JACK_MOVED': return `잭의 이동 · ${modeName[e.mode] ?? '도보'}`;
    case 'DISCOVERY_REVEALED': return `${e.location}번 발견 장소 공개`;
    case 'CRIME_DISCOVERED': return `${e.positions.join(' · ')}번에서 사건 발생`;
    case 'JACK_ESCAPED': return '잭이 은신처로 돌아갔습니다';
    case 'PATROL_REVEALED': return `${crossingLabel(gameType,e.position)} · ${e.officerId ? `${colorName[e.officerId]} 경찰` : '가짜 순찰'}`;
    case 'WRETCHED_MOVED': return `여성 이동 · ${e.from} → ${e.to}번`;
    case 'NIGHT_STARTED': return `${e.night}번째 밤의 시작`;
    case 'ROUND_STARTED': return '다음 발견 장소를 향한 추적 시작';
    case 'GAME_ENDED': case 'MATCH_ENDED': return '사건 종료';
    case 'TIME_ADVANCED': return `기다림 ${e.wait} / 5`;
    case 'POLICE_DEPLOYED': return '수사관 배치 완료';
    case 'WOMEN_PLACED': return '여성 토큰 배치 완료';
    case 'VICTIMS_REVEALED': return '실제 여성 토큰 공개';
    case 'PATROLS_PLACED': return '비밀 순찰 배치 완료';
    default: return '사건이 진행됩니다';
  }
}
