import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '../packages/whitechapel-core/src/index.js';
import * as map from '../packages/whitechapel-core/src/map.js';
import { nightRules, prepareNight, beginPolice, wretchedMoves } from '../packages/whitechapel-core/src/state.js';
import { pursuitWeights } from '../packages/whitechapel-core/src/pursuit.js';
const checks=[];
function test(name,run){run();checks.push({scenario:name,observable:'PASS'});}
const players=n=>Array.from({length:n},(_,i)=>({id:`p${i}`,nickname:`Player ${i}`,isHost:i===0,isBot:true}));
const apply=(s,c)=>core.executeCommand(s,c).nextState;
function started(n=2){return apply(core.createInitialState(players(n),{},17),{type:'START_MATCH',playerId:'p0'});}
function setup(){let s=apply(started(),{type:'CHOOSE_HIDEOUT',playerId:'p0',to:90});while(s.playPhase!=='KILL_OR_WAIT'){const id=core.getPendingActors(s)[0];s=apply(s,core.chooseBotCommand(core.getBotObservation(s,id),id));}return s;}
function hunt(){let s=setup();return apply(s,{type:'MURDER',playerId:'p0',victims:[s.wretched[0]]});}
function moveFixture(position=103){const s=hunt();s.position=position;s.trail=[position];s.beliefs=[position];s.police.forEach((p,i)=>p.position=map.policeStarts[i]);return s;}
test('429 vertices, 195 circles, 234 crossings, 592 symmetric edges and connected graph',()=>{
  assert.equal(map.nodes.length,429);assert.equal(map.numbers.length,195);assert.equal(map.nodes.filter(n=>n.kind==='crossing').length,234);
  assert.equal(map.nodes.reduce((n,v)=>n+v.adjacent.length,0)/2,592);assert.deepEqual(map.numbers,Array.from({length:195},(_,i)=>i+1));
  for(const n of map.nodes)for(const id of n.adjacent)assert.ok(map.nodeById[id].adjacent.includes(n.id));
  const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const id of map.nodeById[queue[i]].adjacent)if(!seen.has(id)){seen.add(id);queue.push(id);}assert.equal(seen.size,429);
  assert.equal(map.blocks.length,164);assert.deepEqual(map.nodes.filter(n=>n.isPoliceStart).map(n=>n.id).sort((a,b)=>a-b),map.policeStarts);
  assert.deepEqual(map.nodes.filter(n=>n.isCrimeSite).map(n=>n.number).sort((a,b)=>a-b),map.redNumbers);
});
test('official pages 13/15/19/20 movement examples',()=>{
  assert.deepEqual(map.jackDestinations(65),[51,63,66,67,82,83,84]);assert.ok(map.jackDestinations(127).includes(103));
  assert.ok(map.jackDestinations(103).includes(69));assert.ok(map.jackDestinations(69).includes(56));
  assert.ok(map.blocks.some(b=>JSON.stringify([...b].sort((a,b)=>a-b))===JSON.stringify([56,57,69,70,71,72,73])));
  assert.ok(map.nodes.some(n=>n.kind==='crossing'&&JSON.stringify(map.inspectableNumbers(n.id))===JSON.stringify([99,100,120])));
});
test('player limits, host authorization, valid Jack selection and permanent nonred hideout',()=>{
  assert.throws(()=>core.createInitialState(players(1)));assert.throws(()=>core.createInitialState(players(7)));
  assert.throws(()=>core.createInitialState(players(2),{jackPlayerId:'stranger'}));
  assert.equal(core.createInitialState(players(6),{jackPlayerId:'p3'}).jackPlayerId,'p3');
  assert.throws(()=>apply(core.createInitialState(players(2)),{type:'START_MATCH',playerId:'p1'}));
  assert.throws(()=>apply(started(),{type:'CHOOSE_HIDEOUT',to:3,playerId:'p0'}));
  assert.throws(()=>apply(started(),{type:'CHOOSE_HIDEOUT',to:90,playerId:'p1'}));
  assert.throws(()=>apply(started(),{type:'toString',playerId:'p0'}));
});
test('setup decoys and head-only patrol identity; later-night positions preserve prior crossings',()=>{
  const s=setup(), jack=core.getPrivateView(s,'p0'),police=core.getPrivateView(s,'p1');
  assert.equal(jack.patrols,undefined);assert.equal(police.patrols.length,7);assert.equal(police.patrols.filter(p=>p.officerId===null).length,2);
  assert.ok(core.getPublicView(s).patrols.every(p=>p.officerId===undefined));
  const next=structuredClone(s);next.roundNumber=2;next.police.forEach((p,i)=>p.position=map.nodes.filter(n=>n.kind==='crossing')[i].id);prepareNight(next);
  const id=core.getPendingActors(next)[0];const placed=apply(next,core.chooseBotCommand(core.getBotObservation(next,id),id));
  const cmd=core.chooseBotCommand(core.getBotObservation(placed,placed.headPlayerId),placed.headPlayerId);
  const accepted=apply(placed,cmd);assert.ok(placed.police.every(p=>accepted.patrols.some(t=>t.position===p.position)));
  const bad=structuredClone(cmd);bad.patrols[0].position=428;assert.throws(()=>apply(placed,bad));
});
test('every waiting cycle moves all women, reveals patrol; V cannot wait; delay adds track slots',()=>{
  let s=setup();
  for(let i=2;i<=5;i++){
    s=apply(s,{type:'WAIT',playerId:'p0'});assert.equal(s.wait,i);
    assert.throws(()=>apply(s,{type:'MURDER',playerId:'p0',victims:[s.wretched[0]]}));
    while(s.playPhase==='MOVE_WRETCHED'){
      const choices=core.getPrivateView(s,s.headPlayerId).legal.commands;assert.ok(choices.length);s=apply(s,{...choices[0],playerId:s.headPlayerId});
    }
    assert.equal(s.playPhase,'REVEAL_PATROL');const reveal=core.getPrivateView(s,'p0').legal.commands[0];s=apply(s,{...reveal,playerId:'p0'});
  }
  assert.throws(()=>apply(s,{type:'WAIT',playerId:'p0'}));s=apply(s,{type:'MURDER',playerId:'p0',victims:[s.wretched[0]]});assert.equal(s.track,-4);
});
test('wretched cannot cross patrol, end adjacent to patrol, overlap or enter crime scene',()=>{
  const s=setup();s.wretched=[65,63];s.crimeScenes=[66];
  for(const to of wretchedMoves(s,65)) if(to!==65){assert.ok(![63,66].includes(to));assert.ok(s.patrols.every(p=>!map.inspectableNumbers(p.position).includes(to)));}
  const empty={...s,patrols:[],wretched:[65],crimeScenes:[]};assert.deepEqual(wretchedMoves(empty,65),map.jackDestinations(65));
});
test('normal blocks crossings, coach bypasses and records two distinct locations, alley records one',()=>{
  let s=moveFixture(103);const crossing=map.nodes.find(n=>n.kind==='crossing'&&map.inspectableNumbers(n.id).includes(103));s.police[0].position=crossing.id;
  const coach={type:'JACK_MOVE',mode:'coach',via:69,to:56,playerId:'p0'};const r=core.executeCommand(s,coach);assert.deepEqual(r.nextState.trail,[103,69,56]);assert.equal(r.nextState.track,s.track+2);assert.equal(r.nextState.specials.coach,2);
  assert.ok(!JSON.stringify(r.events).includes('69'));assert.deepEqual(s.trail,[103]);
  assert.throws(()=>apply(s,{...coach,to:103}));assert.throws(()=>apply(s,{...coach,to:69}));
  s=moveFixture(56);s.hideout=72;const alley=apply(s,{type:'JACK_MOVE',mode:'alley',to:72,playerId:'p0'});assert.equal(alley.matchState,'PLAYING');assert.deepEqual(alley.trail,[56,72]);assert.equal(alley.track,1);
  for(const to of map.jackDestinations(s.position,s.police.map(p=>p.position))) assert.ok(core.getPrivateView(s,'p0').legal.commands.some(c=>c.mode==='normal'&&c.to===to));
});
test('surrounded Jack loses without specials; specials permit escape; coach requires two free slots',()=>{
  let s=moveFixture(1);s.specials={coach:0,alley:0};
  const exits=map.locationByNumber[1].adjacent;assert.ok(exits.every(id=>map.nodeById[id].kind==='crossing'));
  s.police.forEach((p,i)=>p.position=exits[i]??map.policeStarts[i]);
  assert.deepEqual(map.jackDestinations(1,s.police.map(p=>p.position)),[]);
  assert.equal(apply(s,core.getAutomaticCommand(s)).outcome.reason,'BLOCKED');
  s.specials.coach=1;assert.equal(core.getAutomaticCommand(s),null);assert.ok(core.getPrivateView(s,'p0').legal.commands.every(c=>c.mode==='coach'));
  s.track=14;assert.ok(!core.getPrivateView(s,'p0').legal.commands.some(c=>c.mode==='coach'));
  s=moveFixture(127);s.track=14;s.hideout=103;assert.equal(apply(s,{type:'JACK_MOVE',mode:'normal',to:103,playerId:'p0'}).matchState,'ROUND_END');
});
test('all officers move before actions; control order and overlap validation',()=>{
  let s=moveFixture();beginPolice(s,'POLICE_MOVE');
  assert.throws(()=>apply(s,{type:'SEARCH',officerId:s.pendingPolice[0],to:99,playerId:'p1'}));
  for(let i=0;i<5;i++){const p=s.police.find(p=>p.id===s.pendingPolice[0]);const other=s.police.find(q=>q.id!==p.id);assert.throws(()=>apply(s,{type:'POLICE_MOVE',officerId:p.id,to:other.position,playerId:'p1'}));s=apply(s,{type:'POLICE_MOVE',officerId:p.id,to:p.position,playerId:'p1'});}
  assert.equal(s.playPhase,'POLICE_ACTION');assert.equal(s.pendingPolice.length,5);
});
test('search continues on negatives, stops on hit; arrest checks current location only',()=>{
  let s=moveFixture();beginPolice(s,'POLICE_ACTION');const p=s.police.find(p=>p.id===s.pendingPolice[0]);
  p.position=map.nodes.find(n=>n.kind==='crossing'&&map.inspectableNumbers(n.id).length>=3).id;
  const [a,b,c]=map.inspectableNumbers(p.position);s.trail=[b,c];s.position=c;
  s=apply(s,{type:'SEARCH',officerId:p.id,to:a,playerId:p.ownerId});assert.ok(s.pendingPolice.includes(p.id));
  assert.throws(()=>apply(s,{type:'ARREST',officerId:p.id,to:c,playerId:p.ownerId}));
  s=apply(s,{type:'SEARCH',officerId:p.id,to:b,playerId:p.ownerId});assert.ok(!s.pendingPolice.includes(p.id));assert.ok(s.clues.includes(b));
  const make=()=>{const t=structuredClone(s);beginPolice(t,'POLICE_ACTION');return t;};
  assert.equal(apply(make(),{type:'ARREST',officerId:p.id,to:b,playerId:p.ownerId}).matchState,'PLAYING');
  const caught=apply(make(),{type:'ARREST',officerId:p.id,to:c,playerId:p.ownerId});assert.equal(caught.outcome.reason,'ARREST');
});
test('third-night crime order stays private and consumes one move with police first',()=>{
  let s=setup();s.roundNumber=3;s.wretched=[3,27,65];
  const a=core.executeCommand(s,{type:'MURDER',victims:[27,3],playerId:'p0'}),b=core.executeCommand(s,{type:'MURDER',victims:[3,27],playerId:'p0'});
  assert.equal(a.nextState.position,3);assert.equal(a.nextState.track,1);assert.equal(a.nextState.playPhase,'POLICE_MOVE');
  assert.deepEqual(core.getPublicView(a.nextState),core.getPublicView(b.nextState));assert.deepEqual(a.events,b.events);
  assert.deepEqual(core.getBotObservation(a.nextState,'p1'),core.getBotObservation(b.nextState,'p1'));
});
test('deadline, blocked auto-command, four normal hideout returns and night replenishment',()=>{
  let s=moveFixture(56);s.hideout=72;s.track=14;let end=apply(s,{type:'JACK_MOVE',mode:'alley',to:72,playerId:'p0'});assert.equal(end.outcome.reason,'TIME_EXPIRED');
  s.track=15;const auto=core.getAutomaticCommand(s);assert.equal(auto.type,'_CHECK_BLOCKED');assert.ok(!core.allowedCommands.includes(auto.type));assert.equal(apply(s,auto).outcome.winner,'POLICE');
  for(let night=1;night<=4;night++){
    s=moveFixture(127);s.roundNumber=night;s.completedNights=night-1;s.hideout=103;
    s.police.forEach((p,i)=>p.position=map.policeStarts[i]);
    const route=map.jackDestinations(127,s.police.map(p=>p.position));assert.ok(route.includes(103));
    end=apply(s,{type:'JACK_MOVE',mode:'normal',to:103,playerId:'p0'});assert.equal(end.completedNights,night);
    if(night<4){assert.equal(end.matchState,'ROUND_END');assert.throws(()=>apply(end,{type:'ADVANCE_ROUND',playerId:'p1'}));const next=apply(end,{type:'ADVANCE_ROUND',playerId:'p0'});assert.deepEqual(next.specials,{coach:nightRules[night].coach,alley:nightRules[night].alley});}
    else assert.equal(end.outcome.winner,'JACK');
  }
});
test('optional normal hideout declaration supports secret pass-through and validates escape flags',()=>{
  const s=moveFixture(127);s.hideout=103;
  const command={type:'JACK_MOVE',mode:'normal',to:103,playerId:'p0'};
  const declared=core.executeCommand(s,{...command,escape:true});
  assert.equal(declared.nextState.matchState,'ROUND_END');assert.equal(declared.nextState.completedNights,1);
  const continued=core.executeCommand(s,{...command,escape:false});
  assert.equal(continued.nextState.position,103);assert.equal(continued.nextState.playPhase,'POLICE_MOVE');
  assert.equal(continued.nextState.completedNights,0);assert.deepEqual(continued.nextState.trail,[127,103]);
  assert.deepEqual(continued.nextState.escapedBeliefs,s.escapedBeliefs);
  const other=structuredClone(s);other.hideout=90;
  const ordinary=core.executeCommand(other,command);
  assert.deepEqual(core.getPublicView(continued.nextState),core.getPublicView(ordinary.nextState));
  assert.deepEqual(core.getBotObservation(continued.nextState,'p1'),core.getBotObservation(ordinary.nextState,'p1'));
  assert.deepEqual(continued.events,ordinary.events);
  assert.deepEqual(core.getPendingActors(continued.nextState),core.getPendingActors(ordinary.nextState));
  for(const escape of [null,0,1,'false',{},[]])assert.throws(()=>apply(s,{...command,escape}));
  assert.throws(()=>apply(other,{...command,escape:true}));
  const special=moveFixture(56);special.hideout=72;
  assert.throws(()=>apply(special,{type:'JACK_MOVE',mode:'alley',to:72,escape:true,playerId:'p0'}));
  special.position=103;special.hideout=56;
  assert.throws(()=>apply(special,{type:'JACK_MOVE',mode:'coach',via:69,to:56,escape:true,playerId:'p0'}));
  const last=structuredClone(s);last.track=14;
  assert.equal(apply(last,{...command,escape:false}).outcome.reason,'TIME_EXPIRED');
  assert.equal(apply(last,{...command,escape:true}).matchState,'ROUND_END');
});
test('projection independence, nonparticipant secrecy, immutable accepted/rejected commands',()=>{
  const s=moveFixture(),other=structuredClone(s);other.hideout=44;other.position=11;other.trail=[11,42];
  assert.deepEqual(core.getPublicView(s),core.getPublicView(other));assert.deepEqual(core.getBotObservation(s,'p1'),core.getBotObservation(other,'p1'));assert.equal(core.getPrivateView(s,'outsider'),null);
  const before=JSON.stringify(s);assert.throws(()=>apply(s,{type:'JACK_MOVE',to:500,playerId:'p0'}));assert.equal(JSON.stringify(s),before);
  const id=core.getPendingActors(s)[0],cmd=core.chooseBotCommand(core.getBotObservation(s,id),id);const r=apply(s,cmd);assert.equal(r.stateVersion,s.stateVersion+1);assert.equal(JSON.stringify(s),before);
});
const matches=[];
test('positive trail clue conditions routes without fixing current position; coach intermediate counts',()=>{
  const paths=from=>from===1?[[2],[3]]:from===2?[[4],[5]]:[[6]];
  const moves=[{type:'JACK_MOVED'},{type:'JACK_MOVED'}];
  const scores=pursuitWeights([1],[...moves,{type:'CLUE_SEARCHED',location:2,found:true}],paths);
  assert.ok(scores.get(4)>0&&scores.get(5)>0);assert.equal(scores.get(6),0);
  const coach=pursuitWeights([1],[{type:'JACK_MOVED'},{type:'CLUE_SEARCHED',location:2,found:true}],()=>[[2,4],[3,6]]);
  assert.equal(coach.get(4),1);assert.equal(coach.get(6),0);
  const doubleCrime=pursuitWeights([1,2],[{type:'CLUE_SEARCHED',location:1,found:true}],paths);
  assert.equal(doubleCrime.get(1),0.5);assert.equal(doubleCrime.get(2),0.5);
});
test('detective decisions and factual hunt history ignore hidden world; escaped inference survives new night',()=>{
  let s=moveFixture();beginPolice(s,'POLICE_ACTION');const changed=structuredClone(s);
  changed.hideout=44;changed.position=11;changed.trail=[11,42];changed.decisionSeed=999;
  const id=core.getPendingActors(s)[0];
  assert.deepEqual(core.chooseBotCommand(core.getBotObservation(s,id),id),core.chooseBotCommand(core.getBotObservation(changed,id),id));
  const p=s.police.find(p=>p.id===s.pendingPolice[0]);const target=map.inspectableNumbers(p.position).find(n=>!s.trail.includes(n)&&!changed.trail.includes(n));
  assert.ok(target);const command={type:'SEARCH',officerId:p.id,to:target,playerId:p.ownerId};
  const a=apply(s,command),b=apply(changed,command);
  assert.deepEqual(a.huntHistory,b.huntHistory);assert.deepEqual(core.getBotObservation(a,id),core.getBotObservation(b,id));
  s=moveFixture(127);s.hideout=103;s=apply(s,{type:'JACK_MOVE',mode:'normal',to:103,playerId:'p0'});
  assert.ok(s.escapedBeliefs.includes(103));assert.ok(s.escapedBeliefs.every(n=>!map.redNumbers.includes(n)));
  const homes=[...s.escapedBeliefs];s=apply(s,{type:'ADVANCE_ROUND',playerId:'p0'});
  assert.deepEqual(s.escapedBeliefs,homes);assert.deepEqual(s.huntHistory,[]);
  const source=moveFixture(127),ends=core.getPrivateView(source,'p0').legal.commands.filter(c=>c.mode==='normal'&&!map.redNumbers.includes(c.to));
  assert.ok(ends.length>=2);
  const escapes=ends.slice(0,2).map(command=>{const world=structuredClone(source);world.hideout=command.to;return apply(world,{...command,playerId:'p0'});});
  assert.notEqual(escapes[0].hideout,escapes[1].hideout);
  assert.deepEqual(core.getBotObservation(escapes[0],'p1'),core.getBotObservation(escapes[1],'p1'));
  const seeds=[1,17,29].map(seed=>{const t=apply(core.createInitialState(players(2),{},seed),{type:'START_MATCH',playerId:'p0'});return core.chooseBotCommand(core.getBotObservation(t,'p0'),'p0').to;});
  assert.equal(new Set(seeds).size,3);
});
test('seeded complete 2–6 participant games; deterministic observation-only bots',()=>{
  for(const count of [2,3,4,5,6])for(const seed of [1,17,29]){
    let s=core.createInitialState(players(count),{jackPlayerId:seed===29?'p1':'p0'},seed),steps=0;
    while(s.matchState!=='GAME_OVER'&&steps<2000){
      const id=core.getPendingActors(s)[0];const observation=id?core.getBotObservation(s,id):null;
      const automatic=core.getAutomaticCommand(s);const cmd=automatic||core.chooseBotCommand(observation,id);
      assert.ok(cmd,`${count}/${seed} missing ${s.playPhase}`);if(!automatic)assert.deepEqual(cmd,core.chooseBotCommand(structuredClone(observation),id));
      s=apply(s,cmd);steps++;
    }
    assert.equal(s.matchState,'GAME_OVER',`${count}/${seed} stalled`);assert.ok(s.outcome);matches.push({count,seed,steps,night:s.roundNumber,completedNights:s.completedNights,outcome:s.outcome});
  }
});
const evidence={invocation:'node tests/whitechapel_core.test.js',capturedAt:new Date().toISOString(),checks,matches,limitations:['Core behavioral verification only; browser and service integration belong to parent task.','Topology independently crosschecked against printed examples; every street was not retraced from artwork.']};
fs.mkdirSync('.omo/evidence/new-games',{recursive:true});fs.writeFileSync('.omo/evidence/new-games/whitechapel-core.json',JSON.stringify(evidence,null,2));
fs.mkdirSync('output/new-games',{recursive:true});fs.writeFileSync('output/new-games/whitechapel-core.json',JSON.stringify(evidence,null,2));
console.log(`Whitechapel: ${checks.length} scenarios PASS; ${matches.length} complete AI games`,matches.map(m=>`${m.count}/${m.seed}:${m.outcome.winner}@${m.night}`).join(' '));
