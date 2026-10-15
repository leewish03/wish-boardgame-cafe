import { circles as rawCircles, squares, connections, alley_groups, water_groups } from './map-data.js';

export const circles = rawCircles.map(c => ({ ...c, quadrant: `${c.y < 600 ? 'N' : 'S'}${c.x < 600 ? 'W' : 'E'}` })).sort((a, b) => a.id - b.id);
export const crossings = squares;
export const edges = connections;
export const alleyGroups = alley_groups.map(g => g.map(Number));
export const waterGroups = water_groups.map(g => g.map(Number));
export const circleById = Object.fromEntries(circles.map(c => [c.id, c]));
export const crossingById = Object.fromEntries(crossings.map(c => [c.id, c]));
export const startingCrossings = crossings.filter(c => c.starting).map(c => c.id);
export const adjacency = Object.fromEntries([...circles, ...crossings].map(n => [n.id, []]));
for (const [a, b] of edges) { adjacency[a].push(b); adjacency[b].push(a); }

// Stop at the next object of the moving role; traversed opposite-role nodes do not consume a step.
export function neighbors(from, role, blocked = []) {
  const found = new Set(), visited = new Set([String(from)]), queue = [String(from)];
  for (let i = 0; i < queue.length; i++) {
    for (const next of adjacency[queue[i]] ?? []) {
      if (visited.has(next) || blocked.includes(next)) continue;
      visited.add(next);
      const target = role === 'JACK' ? circleById[next] : crossingById[next];
      if (target) found.add(role === 'JACK' ? Number(next) : next);
      else queue.push(next);
    }
  }
  return [...found];
}

export const adjacentCircles = crossing => (adjacency[crossing] ?? []).filter(id => circleById[id]).map(Number);
export const groupDestinations = (from, groups) => [...new Set(groups.filter(g => g.includes(from)).flat())].filter(id => id !== from);
export function policeDestinations(pawn, police) {
  const one = neighbors(pawn.position, 'POLICE');
  return [...new Set([pawn.position, ...one, ...one.flatMap(id => neighbors(id, 'POLICE'))])]
    .filter(id => !police.some(p => p.id !== pawn.id && p.position === id));
}

const distances = new Map();
export function distance(from, goals) {
  if (!distances.has(from)) {
    const result = new Map([[from, 0]]), queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      for (const next of neighbors(id, 'JACK')) if (!result.has(next)) { result.set(next, result.get(id) + 1); queue.push(next); }
    }
    distances.set(from, result);
  }
  return Math.min(...goals.map(id => distances.get(from).get(id) ?? Infinity));
}
