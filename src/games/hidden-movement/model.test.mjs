import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as hall from '../../../packages/whitehall-core/src/index.js';
import * as chapel from '../../../packages/whitechapel-core/src/index.js';
import { boards, legalCommands, commandTarget, commandLabel, crossingLabel, publicEventTarget, mapFocusView, initialSetupDraft, commandVia, previewKeys, setupSubmission, placePatrol, patrolHitRadius } from './model.js';
import { zoomAt } from './useMapGestures.js';

assert.deepEqual(initialSetupDraft(),{values:[],real:[],assignments:{}});
assert.deepEqual(initialSetupDraft({legal:{women:3,womanNumbers:[3,21,27]}}).values,[3,21,27]);
assert.deepEqual(initialSetupDraft({legal:{women:2,womanNumbers:[3,21,27]}}).values,[]);
assert.deepEqual(initialSetupDraft({legal:{patrolRequired:[1],patrolStarts:[1,2,3,4,5,6,7]}}).values,[1,2,3,4,5,6,7]);
assert.deepEqual(initialSetupDraft({legal:{patrolRequired:[1],patrolStarts:[2,3,4,5,6,7,8]}}).values,[1]);
assert.equal(commandVia({path:[10,20]}),10);
assert.equal(commandVia({type:'MURDER',victims:[84,65]}),84,'double crime selection preserves first victim order');
assert.equal(setupSubmission({},initialSetupDraft()),null);
const patrolSecret={legal:{patrolStarts:[1,2,3,4,5,6,7]}},patrolDraft={values:[1,2,3,4,5,6,7],assignments:{1:'blue',2:'red',3:'green',4:'brown',5:'yellow'}};
assert.equal(setupSubmission(patrolSecret,patrolDraft).ready,true);
assert.equal(setupSubmission(patrolSecret,{...patrolDraft,assignments:{...patrolDraft.assignments,5:'blue'}}).ready,false);
assert.deepEqual(setupSubmission(patrolSecret,patrolDraft).command.patrols.slice(-2),[{position:6,officerId:null},{position:7,officerId:null}]);
const movedPatrol=placePatrol(patrolDraft,6,'blue');
assert.equal(movedPatrol.assignments[1],undefined);
assert.equal(movedPatrol.assignments[6],'blue');
assert.equal(setupSubmission(patrolSecret,movedPatrol).ready,true);
const swappedPatrol=placePatrol(patrolDraft,2,'blue');
assert.equal(swappedPatrol.assignments[1],'red');
assert.equal(swappedPatrol.assignments[2],'blue');
assert.equal(setupSubmission(patrolSecret,swappedPatrol).ready,true);
assert.equal(placePatrol(patrolDraft,1,'blue').assignments[1],undefined);
assert.equal(placePatrol(patrolDraft,99,'blue'),patrolDraft);
assert.equal(placePatrol(patrolDraft,1,'invalid'),patrolDraft);
assert.equal(patrolDraft.assignments[1],'blue','preview changes must not mutate the previous draft');
const closePatrols=[{key:'a',x:0,y:0},{key:'b',x:10,y:0},{key:'c',x:100,y:100}];
assert.ok(patrolHitRadius(closePatrols[0],closePatrols,3)+patrolHitRadius(closePatrols[1],closePatrols,3)<10,'nearby patrol hit areas never overlap');
assert.equal(patrolHitRadius(closePatrols[2],closePatrols,1),22,'isolated patrol keeps a 44px target');
assert.deepEqual(previewKeys({police:[]},{role:'POLICE'},{type:'JACK_MOVE',to:20}),[]);
assert.deepEqual(previewKeys({police:[]},{role:'JACK',position:9},{type:'JACK_MOVE',path:[10,20]}),['n:9','n:10','n:20']);
const view={x:0,y:0,w:100,h:50},anchor={x:25,y:10},limits={min:20,max:130};
for(const factor of [.1,.5,1,2]) {
  const zoom=zoomAt(view,anchor,factor,limits);
  assert.ok(zoom.w>=20&&zoom.w<=130);
  assert.equal((anchor.x-zoom.x)/zoom.w,(anchor.x-view.x)/view.w);
  assert.equal((anchor.y-zoom.y)/zoom.h,(anchor.y-view.y)/view.h);
}

assert.equal(publicEventTarget([{type:'DISCOVERY_REVEALED',location:36},{type:'GAME_ENDED'}]),'n:36','final public discovery must focus its map location');
assert.equal(publicEventTarget([{type:'CRIME_DISCOVERED',positions:[65,96]}]),'n:96','public crime must be visible on the map');
assert.equal(publicEventTarget([{type:'JACK_MOVED',to:36},{type:'JACK_ROUTE',path:[60,36]}]),null,'hidden Jack movement must never become a public focus target');
assert.equal(publicEventTarget([{type:'POLICE_MOVED',to:'c7'}]),'c:c7');
const crimeView=mapFocusView(boards.WHITECHAPEL,['n:149','n:158']);
for(const key of ['n:149','n:158']) {
  const point=boards.WHITECHAPEL.byKey[key];
  assert.ok(point.x>crimeView.x&&point.x<crimeView.x+crimeView.w&&point.y>crimeView.y&&point.y<crimeView.y+crimeView.h,'both public crime sites must fit in the focused map');
}
assert.equal(mapFocusView(boards.WHITEHALL,['not-a-location']),null);

const evidence={invocation:'node src/games/hidden-movement/model.test.mjs',scenarios:[],passes:true};
const players=[{id:'jack',nickname:'잭',isHost:true},{id:'police',nickname:'수사관'}];
for(const core of [hall,chapel]) {
  let state=core.createInitialState(players,{},21), steps=0, phases=new Set(), legalCount=0;
  while(state.matchState!=='GAME_OVER'&&steps<1500) {
    phases.add(state.playPhase);
    const automatic=core.getAutomaticCommand(state);
    let command=automatic;
    if(!command) {
      const actor=core.getPendingActors(state)[0]??'jack';
      const publicGame=core.getPublicView(state), secret=core.getPrivateView(state,actor);
      for(const c of legalCommands(publicGame,secret)) {
        assert.ok(commandLabel(c,state.gameType).length>0);
        const target=commandTarget(c);
        if(target)assert.ok(boards[state.gameType].byKey[target],`${state.gameType} ${target}`);
        legalCount++;
      }
      command=state.matchState==='LOBBY'?{type:'START_MATCH',playerId:'jack'}:state.matchState==='ROUND_END'?{type:'ADVANCE_ROUND',playerId:'jack'}:core.chooseBotCommand(core.getBotObservation(state,actor),actor);
      assert.ok(command,`${state.gameType} ${state.playPhase} has command`);
    }
    state=core.executeCommand(state,command).nextState;steps++;
  }
  assert.equal(state.matchState,'GAME_OVER');
  const police=core.getPrivateView(state,'police');
  for(const field of ['route','trail','hideout','position','discoveries'])assert.equal(police[field],undefined);
  evidence.scenarios.push({game:core.gameType,steps,phases:[...phases],legalCommandsMapped:legalCount,complete:true,secretFieldsAbsent:true,outcome:state.outcome});
}
for(const type of Object.keys(boards)){
  const labels=boards[type].nodes.filter(n=>n.kind==='crossing').map(n=>crossingLabel(type,n.value));
  for(const label of labels)assert.match(label,/번 옆 교차로$/);
  assert.equal(new Set(labels).size,labels.length,`${type} crossing labels must be unique`);
  evidence.scenarios.push({game:type,crossingLabels:labels.length,uniqueCrossingLabels:true});
}
mkdirSync('.omo/evidence/new-games/map-ui',{recursive:true});
writeFileSync('.omo/evidence/new-games/map-ui/model-check.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
