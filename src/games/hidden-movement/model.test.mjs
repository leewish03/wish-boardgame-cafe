import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as hall from '../../../packages/whitehall-core/src/index.js';
import * as chapel from '../../../packages/whitechapel-core/src/index.js';
import { boards, legalCommands, commandTarget, commandLabel, crossingLabel, publicEventTarget, mapFocusView } from './model.js';

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
