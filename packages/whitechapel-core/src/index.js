import { colors, requireRule as check, prepareNight, finish, currentPolice, jackMoves, legalActions } from './state.js';
import { setupHandlers } from './setup.js';
import { huntHandlers } from './hunt.js';
export { chooseBotCommand } from './ai.js';
export { legalActions } from './state.js';
export const gameType='WHITECHAPEL';
export const minPlayers=2;
export const maxPlayers=6;
export const allowedCommands=['START_MATCH','ADVANCE_ROUND',...Object.keys(setupHandlers),...Object.keys(huntHandlers)];
function shuffledColors(seed) {
  let value=2166136261;
  for (const ch of String(seed)) value=Math.imul(value^ch.charCodeAt(0),16777619)>>>0;
  const result=[...colors];
  for(let i=result.length-1;i>0;i--) { value=(Math.imul(value,1664525)+1013904223)>>>0; const j=value%(i+1); [result[i],result[j]]=[result[j],result[i]]; }
  return result;
}
export function createInitialState(players,config={},seed=1) {
  check(Array.isArray(players)&&players.length>=2&&players.length<=6&&players.every(p=>typeof p.id==='string'&&p.id)&&new Set(players.map(p=>p.id)).size===players.length,'2~6명의 서로 다른 참가자가 필요합니다.');
  const host=players.find(p=>p.isHost)||players[0];
  const jackPlayerId=config.jackPlayerId??host.id;
  check(players.some(p=>p.id===jackPlayerId),'잭은 참가자 중에서 선택해 주세요.');
  const detectives=players.filter(p=>p.id!==jackPlayerId);
  return {gameType,matchState:'LOBBY',playPhase:'LOBBY',roundNumber:1,stateVersion:0,
    players:players.map(p=>({id:p.id,nickname:p.nickname||p.id,isHost:p.id===host.id,isBot:Boolean(p.isBot)})),config:{jackPlayerId},jackPlayerId,
    police:colors.map((id,i)=>({id,ownerId:detectives[i%detectives.length].id,position:null})),
    headOrder:shuffledColors(seed),headColor:null,headPlayerId:null,policeOrder:[],pendingPolice:[],
    decisionSeed:seed,hideout:null,position:null,trail:[],crimeScenes:[],nightCrimes:[],completedNights:0,
    women:[],wretched:[],patrols:[],clues:[],searches:[],beliefs:[],movementHistory:[],huntHistory:[],escapedBeliefs:null,specials:{coach:0,alley:0},wait:1,track:0,outcome:null};
}
export function executeCommand(state,command) {
  check(command && typeof command.type==='string','명령을 확인해 주세요.');
  const s=structuredClone(state), c=command;
  let events;
  if(c.type==='START_MATCH'||c.type==='ADVANCE_ROUND') {
    check(s.players.some(p=>p.id===c.playerId&&p.isHost),'방장만 진행할 수 있습니다.');
    if(c.type==='START_MATCH') { check(s.matchState==='LOBBY','이미 시작된 게임입니다.'); s.matchState='PLAYING';s.playPhase='CHOOSE_HIDEOUT';events=[{type:'MATCH_STARTED'}]; }
    else { check(s.matchState==='ROUND_END','아직 밤이 끝나지 않았습니다.');s.roundNumber++;prepareNight(s);events=[{type:'NIGHT_STARTED',night:s.roundNumber}]; }
  } else if(c.type==='_CHECK_BLOCKED') {
    check(s.matchState==='PLAYING'&&s.playPhase==='JACK_MOVE'&&jackMoves(s).length===0,'강제 종료 조건이 아닙니다.');
    finish(s,'POLICE',s.track>=15?'TIME_EXPIRED':'BLOCKED');events=[];
  } else {
    check(s.matchState==='PLAYING','진행 중인 게임이 아닙니다.');
    const handler=Object.hasOwn(setupHandlers,c.type)?setupHandlers[c.type]:Object.hasOwn(huntHandlers,c.type)?huntHandlers[c.type]:null;
    check(handler,'지원하지 않는 명령입니다.'); events=handler(s,c);
  }
  s.stateVersion++;
  if(s.matchState==='GAME_OVER') events.push({type:'MATCH_ENDED',outcome:structuredClone(s.outcome)});
  return {nextState:s,events};
}
export function getAutomaticCommand(s) {
  return s.matchState==='PLAYING'&&s.playPhase==='JACK_MOVE'&&jackMoves(s).length===0?{type:'_CHECK_BLOCKED'}:null;
}
export function getPendingActors(s) {
  if(s.matchState==='GAME_OVER'||getAutomaticCommand(s))return [];
  if(s.matchState==='LOBBY'||s.matchState==='ROUND_END')return [s.players.find(p=>p.isHost).id];
  if(['PLACE_PATROLS','MOVE_WRETCHED'].includes(s.playPhase))return [s.headPlayerId];
  if(['POLICE_MOVE','POLICE_ACTION'].includes(s.playPhase))return [...new Set(currentPolice(s).map(p=>p.ownerId))];
  return [s.jackPlayerId];
}
export function getPublicView(s) {
  return structuredClone({gameType,matchState:s.matchState,playPhase:s.playPhase,roundNumber:s.roundNumber,stateVersion:s.stateVersion,
    players:s.players,config:s.config,jackPlayerId:s.jackPlayerId,police:s.police,headColor:s.headColor,headPlayerId:s.headPlayerId,
    pendingPolice:s.pendingPolice,pendingActors:getPendingActors(s),women:s.women.map(w=>({position:w.position})),wretched:s.wretched,
    patrols:s.patrols.map(p=>({position:p.position,revealed:p.revealed,...(p.revealed?{officerId:p.officerId}:{})})).sort((a,b)=>a.position-b.position),
    crimeScenes:s.crimeScenes,nightCrimes:s.nightCrimes,clues:s.clues,searches:s.searches,specials:s.specials,wait:s.wait,track:s.track,
    movementHistory:s.movementHistory,huntHistory:s.huntHistory,escapedBeliefs:s.escapedBeliefs,completedNights:s.completedNights,outcome:s.outcome});
}
export function getPrivateView(s,playerId) {
  if(!s.players.some(p=>p.id===playerId))return null;
  const jack=playerId===s.jackPlayerId;
  return structuredClone({role:jack?'JACK':'POLICE',legal:legalActions(s,playerId),
    ...(jack?{decisionSeed:s.decisionSeed,hideout:s.hideout,position:s.position,trail:s.trail,women:s.women}: {beliefs:s.beliefs}),
    ...(playerId===s.headPlayerId?{patrols:s.patrols}: {})});
}
export function getBotObservation(s,playerId) { return {game:getPublicView(s),mySecret:getPrivateView(s,playerId)}; }
export function projectEvents(events) { return structuredClone(events); }
