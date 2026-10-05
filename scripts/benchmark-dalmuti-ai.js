import assert from 'node:assert/strict';
import { createInitialState, executeCommand, chooseBotCommand, createDeck } from '../packages/dalmuti-core/src/index.js';

const matches = Number(process.env.DALMUTI_BENCHMARK_MATCHES || 200);
const profiles = ['AGGRESSIVE', 'DEFENSIVE', 'CALCULATING', 'STRATEGIC', 'INFORMATIVE'];
const metrics = {};
for (const count of [4, 6, 8]) {
  const stats = Object.fromEntries(profiles.map((profile) => [profile, { actions: 0, passes: 0, leads: 0, leadCards: 0, finish: 0, finishes: 0, slowestMs: 0, timings: [], seats: {} }]));
  for (let seed = 1; seed <= matches; seed += 1) {
    const players = Array.from({ length: count }, (_, index) => ({ id: `p${index}`, nickname: `P${index}`, isHost: index === 0, isBot: true, personality: profiles[(index + seed) % profiles.length] }));
    let state = createInitialState(players, { roundCount: 5, turnTimeoutSeconds: 0 }, seed);
    ({ nextState: state } = executeCommand(state, { type: 'START_MATCH', playerId: 'p0' }));
    let guard = 0;
    const collectFinish = () => state.finishOrder.forEach((id, position) => {
      const profile = state.players.find((player) => player.id === id).botProfile;
      const seat = state.hierarchy.indexOf(id);
      const seatStats = stats[profile].seats[seat] ||= { finish: 0, rounds: 0 };
      seatStats.finish += position + 1; seatStats.rounds += 1;
      stats[profile].finish += position + 1; stats[profile].finishes += 1;
    });
    while (state.matchState !== 'GAME_OVER' && guard++ < 50_000) {
      if (state.matchState === 'ROUND_END') {
        collectFinish();
        ({ nextState: state } = executeCommand(state, { type: 'ADVANCE_ROUND', playerId: 'p0' }));
        continue;
      }
      const actorId = state.currentTurnPlayerId;
      const profile = state.players.find((player) => player.id === actorId).botProfile;
      const before = performance.now();
      const command = chooseBotCommand(state, actorId);
      const elapsed = performance.now() - before;
      stats[profile].timings.push(elapsed);
      stats[profile].slowestMs = Math.max(stats[profile].slowestMs, elapsed);
      stats[profile].actions += 1;
      if (command.type === 'PASS') stats[profile].passes += 1;
      if (command.type === 'PLAY_SET' && state.trick.requiredCount == null) { stats[profile].leads += 1; stats[profile].leadCards += command.count; }
      ({ nextState: state } = executeCommand(state, command));
      const cards = [...Object.values(state.secrets).flatMap((secret) => secret.hand), ...state.discardedCards, ...state.trick.sets.flatMap((set) => set.cards), ...(state.tax?.pairs || []).flatMap((pair) => [...pair.offered, ...(pair.returned || [])])];
      assert.equal(cards.length, createDeck(state.config, count).length, 'card conservation');
      assert.equal(new Set(cards.map((card) => card.id)).size, cards.length, 'no duplicate cards');
    }
    if (guard >= 50_000) throw new Error(`${count}인 ${seed}번 매치가 종료되지 않았습니다.`);
    collectFinish();
    if (seed % 40 === 0) console.log(`${count} players: ${seed}/${matches} matches complete`);
  }
  metrics[count] = Object.fromEntries(Object.entries(stats).map(([profile, value]) => [profile, {
    passRate: +(value.passes / value.actions).toFixed(3), leadSize: +(value.leadCards / value.leads).toFixed(2),
    averageFinish: +(value.finish / value.finishes).toFixed(2), slowestDecisionMs: +value.slowestMs.toFixed(2),
    p95DecisionMs: +value.timings.sort((a,b) => a-b)[Math.floor(value.timings.length * .95)]?.toFixed(2),
    seatFinish: Object.fromEntries(Object.entries(value.seats).map(([seat, results]) => [seat, +(results.finish / results.rounds).toFixed(2)])),
  }]));
}
console.log(JSON.stringify({ matches, metrics }, null, 2));
