import { nearestRow, rowPoints, seededRandom } from './index.js';

function bestRow(rows, card, hand) {
  let best = 0;
  let value = Infinity;
  for (let i = 0; i < rows.length; i++) {
    const future = rows.map((row, j) => j === i ? [card] : row);
    const fit = hand.filter(c => nearestRow(future, c) === i && c > card).length;
    const cost = rowPoints(rows[i]) - Math.min(fit, 3) * 0.3;
    if (cost < value) { value = cost; best = i; }
  }
  return best;
}
export function chooseBotCommand(observation, playerId = observation.playerId) {
  if (playerId !== observation.playerId) return null;
  const actions = observation.mySecret.legalActions;
  if (!actions.length) return null;
  const base = { playerId, expectedVersion: observation.stateVersion };
  if (actions[0].type === 'CHOOSE_ROW') {
    return { ...base, type: 'CHOOSE_ROW', rowIndex: bestRow(observation.rows, observation.queue[0].card, observation.mySecret.hand) };
  }
  if (actions[0].type !== 'SELECT_CARD') return { ...base, ...actions[0] };
  const hand = observation.mySecret.hand;
  const known = new Set([...observation.seenCards, ...hand]);
  const unknown = Array.from({ length: 104 }, (_, i) => i + 1).filter(c => !known.has(c));
  const seed = observation.roundNumber * 1009 + observation.turnNumber * 9176 + hand.reduce((sum, card) => sum * 31 + card, 7);
  const random = seededRandom(seed);
  // Common sampled worlds compare every candidate against identical unknown opposition.
  const worlds = Array.from({ length: 80 }, () => {
    const pool = [...unknown];
    return observation.players.filter(p => p.id !== playerId).map(() => pool.splice(Math.floor(random() * pool.length), 1)[0]);
  });
  let best = hand[0];
  let bestCost = Infinity;
  for (const card of hand) {
    let total = 0;
    for (const world of worlds) {
      const rows = observation.rows.map(row => [...row]);
      for (const played of [...world, card].sort((a, b) => a - b)) {
        let index = nearestRow(rows, played);
        const low = index < 0;
        if (low) index = bestRow(rows, played, played === card ? hand.filter(c => c !== card) : []);
        const take = low || rows[index].length === 5;
        if (played === card && take) total += rowPoints(rows[index]);
        if (take) rows[index] = [played];
        else rows[index].push(played);
      }
    }
    const cost = total / worlds.length;
    if (cost < bestCost) { bestCost = cost; best = card; }
  }
  return { ...base, type: 'SELECT_CARD', card: best };
}
