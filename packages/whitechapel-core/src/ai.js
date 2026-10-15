import { distancesFrom, redNumbers, inspectableNumbers, jackDestinations, alleyDestinations } from './map.js';
import { pursuitWeights } from './pursuit.js';
const distanceCache=new Map();
function distances(n) { if(!distanceCache.has(n)) distanceCache.set(n,distancesFrom(n)); return distanceCache.get(n); }
function best(items,score) { return [...items].sort((a,b)=>score(b)-score(a)||JSON.stringify(a).localeCompare(JSON.stringify(b)))[0]; }
export function investigatorWeights(game, beliefs) {
  const weights=pursuitWeights(game.nightCrimes,game.huntHistory??[],(from,event)=> {
    if(event.mode==='normal')return jackDestinations(from,event.blockedCrossings).map(to=>[to]);
    if(event.mode==='alley')return alleyDestinations(from).map(to=>[to]);
    return jackDestinations(from).flatMap(via=>jackDestinations(via).filter(to=>to!==from&&to!==via).map(to=>[via,to]));
  });
  for(const [id,value] of weights) {
    const homes=game.escapedBeliefs;
    const homeDistance=homes?.length?Math.min(...homes.map(home=>distances(home)[id])):0;
    weights.set(id,beliefs.includes(id)?value/(1+homeDistance):0);
  }
  const total=[...weights.values()].reduce((sum,value)=>sum+value,0);
  return total?new Map([...weights].map(([id,value])=>[id,value/total])):new Map(beliefs.map(id=>[id,1/beliefs.length]));
}
export function chooseBotCommand(observation,playerId) {
  const {game:g,mySecret:p}=observation;
  if(!p||!g.pendingActors.includes(playerId))return null;
  const legal=p.legal, commands=legal.commands;
  let choice;
  if(g.playPhase==='PLACE_WOMEN') {
    const positions=legal.womanNumbers.slice(0,legal.women);
    const real=[...positions].sort((a,b)=>distances(p.hideout)[a]-distances(p.hideout)[b]||a-b).slice(0,legal.real);
    choice={type:'PLACE_WOMEN',positions,real};
  } else if(g.playPhase==='PLACE_PATROLS') {
    const positions=[...legal.patrolRequired,...legal.patrolStarts.filter(n=>!legal.patrolRequired.includes(n)).slice(0,7-legal.patrolRequired.length)];
    const scored=[...positions].sort((a,b)=> {
      const score=id=>Math.min(...inspectableNumbers(id).flatMap(n=>g.women.map(w=>distances(w.position)[n])));
      return score(a)-score(b)||a-b;
    });
    choice={type:'PLACE_PATROLS',patrols:scored.map((position,i)=>({position,officerId:legal.colors[i]??null}))};
  } else if(g.playPhase==='CHOOSE_HIDEOUT') {
    const ranked=[...commands].sort((a,b)=>redNumbers.reduce((sum,n)=>sum+distances(a.to)[n]-distances(b.to)[n],0)||a.to-b.to);
    let seed=0;for(const ch of String(p.decisionSeed??1))seed=(Math.imul(seed,31)+ch.charCodeAt(0))>>>0;
    choice=ranked[seed%Math.min(24,ranked.length)];
  } else if(g.playPhase==='KILL_OR_WAIT') {
    const murders=commands.filter(c=>c.type==='MURDER');
    choice=best(murders,c=>-distances(p.hideout)[c.victims.at(-1)]);
  } else if(g.playPhase==='JACK_MOVE') {
    const distance=distances(p.hideout);
    choice=best(commands,c=> {
      if(c.to===p.hideout&&c.mode==='normal')return 10000;
      const danger=g.police.reduce((sum,q)=>sum+(inspectableNumbers(q.position).includes(c.to)?1:0),0);
      const revisit=p.trail.includes(c.to)?1:0;
      return -distance[c.to]*12-danger*16-revisit*3-(c.mode==='normal'?0:c.mode==='coach'?3:2)-(c.to===p.hideout?20:0);
    });
  } else if(g.playPhase==='MOVE_WRETCHED') {
    choice=best(commands,c=>g.patrols.reduce((sum,patrol)=>sum+Math.min(...inspectableNumbers(patrol.position).map(n=>distances(c.to)[n])),0)*-1);
  } else if(g.playPhase==='POLICE_MOVE') {
    const weights=investigatorWeights(g,p.beliefs);
    choice=best(commands,c=> {
      const adjacent=inspectableNumbers(c.to);
      if(!adjacent.length)return -10000;
      const covered=g.police.filter(q=>q.id!==c.officerId).flatMap(q=>inspectableNumbers(q.position));
      const coverage=adjacent.reduce((sum,n)=>sum+(weights.get(n)??0)*(covered.includes(n)?0.15:1),0);
      const travel=[...weights].reduce((sum,[n,w])=>sum+w*Math.min(...adjacent.map(to=>distances(n)[to])),0);
      return coverage*25-travel*2;
    });
  } else if(g.playPhase==='POLICE_ACTION') {
    const weights=investigatorWeights(g,p.beliefs);
    const arrests=commands.filter(c=>c.type==='ARREST'&&(weights.get(c.to)??0)>0);
    const arrest=best(arrests,c=>weights.get(c.to)??0);
    const maxWeight=Math.max(0,...weights.values());
    if(arrest&&((weights.get(arrest.to)??0)>=0.08||(weights.get(arrest.to)??0)>=maxWeight*0.8))choice=arrest;
    else {
      const searches=commands.filter(c=>c.type==='SEARCH');
      choice=best(searches,c=>(weights.get(c.to)??0)*10-(g.clues.includes(c.to)?10:0)-g.searches.filter(s=>s.to===c.to&&s.track===g.track).length*10);
      choice??=commands[0];
    }
  } else choice=commands[0];
  return choice?{...choice,playerId}:null;
}
