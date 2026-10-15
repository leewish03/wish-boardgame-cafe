import { circles, circleById, neighbors, distance, adjacentCircles, groupDestinations, alleyGroups, waterGroups } from './map.js';
import { pursuitWeights } from '../../whitechapel-core/src/pursuit.js';
import { jackMoves } from './rules.js';

function routeToDiscovery(view, secret) {
  const goals=secret.discoveries.filter(id=>!view.revealed.includes(id));
  const danger=view.police.flatMap(p=>adjacentCircles(p.position));
  const remaining=15-view.moveCount, frontier=Array.from({length:remaining+1},()=>[]), seen=new Map(), movesByPosition=new Map();
  const key=node=>`${node.position}/${node.specials.COACH}/${node.specials.ALLEY}/${node.specials.BOAT}`;
  const start={position:secret.position,specials:view.specials,risk:0,first:null};
  frontier[0].push(start);seen.set(key(start),{slots:0,risk:0});
  // Replan against visible crossings each turn; at most 189 * 3^3 position/resource states.
  for(let slots=0;slots<=remaining;slots++) {
    const arrivals=frontier[slots].filter(node=>goals.includes(node.position));
    if(arrivals.length)return arrivals.sort((a,b)=>a.risk-b.risk)[0].first;
    for(const node of frontier[slots]) {
      const known=seen.get(key(node));
      if(known.slots<slots||known.risk<node.risk)continue;
      if(!movesByPosition.has(node.position))movesByPosition.set(node.position,jackMoves({position:node.position,moveCount:0,specials:{COACH:1,ALLEY:1,BOAT:1},police:view.police,discoveries:secret.discoveries,revealed:view.revealed}));
      for(const move of movesByPosition.get(node.position)) {
        const nextSlots=slots+move.path.length;
        if(nextSlots>remaining||(move.mode!=='WALK'&&!node.specials[move.mode]))continue;
        const specials={...node.specials};if(move.mode!=='WALK')specials[move.mode]--;
        const position=move.path.at(-1),risk=node.risk+(danger.includes(position)?8:0)+(move.mode==='WALK'?0:1.5);
        const next={position,specials,risk,first:node.first??move},id=key(next),previous=seen.get(id);
        if(previous&&(previous.slots<nextSlots||previous.slots===nextSlots&&previous.risk<=risk))continue;
        seen.set(id,{slots:nextSlots,risk});frontier[nextSlots].push(next);
      }
    }
  }
  return null;
}

export function investigatorWeights(view) {
  return pursuitWeights([view.revealed.at(-1)],view.history,(from,event)=> {
    switch(event.mode) {
      case 'WALK': return neighbors(from,'JACK',event.blockedCrossings).map(to=>[to]);
      case 'ALLEY': return groupDestinations(from,alleyGroups).map(to=>[to]);
      case 'BOAT': return groupDestinations(from,waterGroups).map(to=>[to]);
      case 'COACH': return neighbors(from,'JACK').filter(v=>circleById[v].color!=='blue').flatMap(v=>neighbors(v,'JACK').filter(to=>to!==from&&circleById[to].color!=='blue').map(to=>[v,to]));
      default: return [];
    }
  });
}

// This conservative belief uses public movement and negative evidence only; positive clues weight the hunt.
export function investigatorBelief(view) {
  let possible = new Set([view.revealed.at(-1)]);
  for (const event of view.history) {
    if (event.type === 'JACK_MOVED') {
      const next = new Set();
      for (const from of possible) {
        let destinations;
        switch (event.mode) {
          case 'WALK': destinations = neighbors(from, 'JACK', event.blockedCrossings); break;
          case 'ALLEY': destinations = groupDestinations(from, alleyGroups); break;
          case 'BOAT': destinations = groupDestinations(from, waterGroups); break;
          case 'COACH': destinations = neighbors(from, 'JACK').filter(v => circleById[v].color !== 'blue')
            .flatMap(v => neighbors(v, 'JACK').filter(to => to !== from && circleById[to].color !== 'blue')); break;
          default: destinations = [];
        }
        destinations.forEach(id => next.add(id));
      }
      possible = next;
    } else if (!event.found) possible.delete(event.location);
  }
  return [...possible];
}

function selectDiscoveryLocations(seed) {
  // Public board geometry selects balanced routes; no hidden state or omniscient opponent inputs.
  return ['NW', 'NE', 'SW', 'SE'].map((quadrant, index) => circles.filter(c => c.color === 'white' && c.quadrant === quadrant)
    .sort((a, b) => Math.hypot(a.x - 600, a.y - 600) - Math.hypot(b.x - 600, b.y - 600) || a.id - b.id)[((seed >>> (index * 3)) + index) % 8].id);
}

export function chooseBotCommand(observation, playerId) {
  const view = observation.public, secret = observation.private, legal = secret?.legal;
  if (!legal) return null;
  const command = body => ({ ...body, playerId });
  switch (view.playPhase) {
    case 'SET_DISCOVERIES': return command({ type: 'SET_DISCOVERIES', locations: selectDiscoveryLocations(secret.decisionSeed) });
    case 'CHOOSE_START': {
      const police = view.police.flatMap(p => adjacentCircles(p.position));
      const to = [...legal.startLocations].sort((a, b) => distance(b, police) - distance(a, police) || a - b)[0];
      return command({ type: 'CHOOSE_START', to });
    }
    case 'DEPLOY': return command({ type: 'DEPLOY', pawnId: legal.pawnId, to: legal.destinations[(view.pawnIndex * 2) % legal.destinations.length] });
    case 'JACK_MOVE': {
      const route=routeToDiscovery(view,secret);
      if(route)return command({type:'JACK_MOVE',...route});
      const goals = secret.discoveries.filter(id => !view.revealed.includes(id));
      const danger = view.police.flatMap(p => adjacentCircles(p.position));
      const score = move => distance(move.path.at(-1), goals) * 6 + (danger.includes(move.path.at(-1)) ? 8 : 0)
        + (move.mode === 'WALK' ? 0 : 1.5) + secret.route.filter(id => id === move.path.at(-1)).length;
      const move = [...legal.moves].sort((a, b) => score(a) - score(b))[0];
      return move ? command({ type: 'JACK_MOVE', ...move }) : null;
    }
    case 'POLICE_MOVE': {
      const weights = investigatorWeights(view);
      const otherCoverage = view.police.filter(p => p.id !== legal.pawnId).flatMap(p => adjacentCircles(p.position));
      const score = to => {
        const targets = adjacentCircles(to);
        const coverage = targets.reduce((sum,id)=>sum+(weights.get(id)??0)*(otherCoverage.includes(id)?0.15:1),0);
        const reach = targets.length ? [...weights].reduce((sum,[id,w])=>sum+w*distance(id,targets),0) : 99;
        return coverage * 25 - reach * 2;
      };
      const to = [...legal.destinations].sort((a, b) => score(b) - score(a) || a.localeCompare(b))[0];
      return command({ type: 'POLICE_MOVE', pawnId: legal.pawnId, to });
    }
    case 'POLICE_ACTION': {
      const weights = investigatorWeights(view);
      const arrests = legal.arrestTargets.filter(id => (weights.get(id)??0)>0).sort((a,b)=>(weights.get(b)??0)-(weights.get(a)??0)||a-b);
      const probability=weights.get(arrests[0])??0;
      if (arrests.length && (probability>=0.08||probability>=Math.max(...weights.values())*0.8)) return command({ type: 'ARREST', pawnId: legal.pawnId, to: arrests[0] });
      const targets = [...legal.searchTargets].sort((a, b) => Number(view.clues.includes(a)) - Number(view.clues.includes(b)) || (weights.get(b)??0)-(weights.get(a)??0) || a - b);
      return command(targets.length ? { type: 'SEARCH', pawnId: legal.pawnId, to: targets[0] } : { type: 'END_ACTION', pawnId: legal.pawnId });
    }
    default: return null;
  }
}
