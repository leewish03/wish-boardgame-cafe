// Independent clue likelihoods keep inference bounded; these scores are not proof of Jack's location.
export function pursuitWeights(starts, history, paths) {
  const clues = [...new Set(history.filter(e => e.type === 'CLUE_SEARCHED' && e.found).map(e => e.location))];
  const transitions = new Map();
  function infer(clue) {
    let distribution = new Map(starts.map(id => [id, [Number(!starts.includes(clue)), Number(starts.includes(clue))]]));
    for (let turn = 0; turn < history.length; turn++) {
      const event = history[turn];
      if (event.type === 'JACK_MOVED') {
        const next = new Map();
        for (const [from, weights] of distribution) {
          const key = `${turn}/${from}`;
          if (!transitions.has(key)) transitions.set(key, paths(from, event));
          const routes = transitions.get(key);
          for (const route of routes) {
            const to = route.at(-1), hit = route.includes(clue);
            const value = next.get(to) ?? [0, 0];
            value[hit ? 1 : 0] += weights[0] / routes.length;
            value[1] += weights[1] / routes.length;
            next.set(to, value);
          }
        }
        distribution = next;
      } else {
        for (const [id, weights] of distribution) {
          if (event.type === 'CLUE_SEARCHED' && event.location === clue) weights[event.found ? 0 : 1] = 0;
          if (!event.found && id === event.location) distribution.delete(id);
        }
      }
      const total = [...distribution.values()].reduce((sum, v) => sum + v[0] + v[1], 0);
      if (total) for (const v of distribution.values()) { v[0] /= total; v[1] /= total; }
    }
    return new Map([...distribution].map(([id, v]) => [id, v[0] + v[1]]));
  }
  const base = infer(null);
  for (const clue of clues) {
    const conditioned = infer(clue);
    for (const [id, weight] of base) base.set(id, weight * (conditioned.get(id) ?? 0));
  }
  const power = 1 / (clues.length + 1);
  const total = [...base.values()].reduce((sum, v) => sum + v ** power, 0);
  return new Map([...base].map(([id, v]) => [id, total ? v ** power / total : 0]));
}
