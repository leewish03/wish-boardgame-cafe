import { nodes, blocks } from './topology.js';
export { nodes, blocks };
export const nodeById = Object.fromEntries(nodes.map(node => [node.id, node]));
export const locationByNumber = Object.fromEntries(nodes.filter(n => n.kind === 'location').map(n => [n.number, n]));
export const redNumbers = [3, 21, 27, 65, 84, 147, 149, 158];
export const policeStarts = [33, 56, 76, 190, 210, 312, 385];
export const numbers = Object.keys(locationByNumber).map(Number);
// Stop at the next space of the moving piece's kind, ignoring spaces of the other kind.
export function connectedSpaces(originId, kind, blocked = []) {
  const seen = new Set([originId, ...blocked]);
  const pending = [...nodeById[originId].adjacent];
  const result = [];
  while (pending.length) {
    const id = pending.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodeById[id];
    if (node.kind === kind) result.push(kind === 'location' ? node.number : id);
    else pending.push(...node.adjacent);
  }
  return result.sort((a, b) => a - b);
}
export const jackDestinations = (number, blocked = []) => connectedSpaces(locationByNumber[number].id, 'location', blocked);
export const crossingNeighbors = id => connectedSpaces(id, 'crossing');
// Inspection cannot pass another crossing, but a numbered circle does not stop adjacency.
export function inspectableNumbers(id) {
  const seen = new Set([id]);
  const pending = [...nodeById[id].adjacent];
  const result = [];
  while (pending.length) {
    const next = pending.pop();
    if (seen.has(next)) continue;
    seen.add(next);
    const node = nodeById[next];
    if (node.kind === 'location') { result.push(node.number); pending.push(...node.adjacent); }
  }
  return result.sort((a, b) => a - b);
}
export function policeDestinations(id, occupied = []) {
  const one = crossingNeighbors(id);
  return [...new Set([id, ...one, ...one.flatMap(crossingNeighbors)])].filter(n => n === id || !occupied.includes(n)).sort((a,b) => a-b);
}
export const alleyDestinations = number => [...new Set(blocks.filter(b => b.includes(number)).flat())].filter(n => n !== number).sort((a,b) => a-b);
export function distancesFrom(number) {
  const distance = { [number]: 0 };
  const queue = [number];
  for (let i = 0; i < queue.length; i++) for (const next of jackDestinations(queue[i])) {
    if (distance[next] === undefined) { distance[next] = distance[queue[i]] + 1; queue.push(next); }
  }
  return distance;
}
