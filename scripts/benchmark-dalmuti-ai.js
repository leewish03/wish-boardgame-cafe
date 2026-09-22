import { createInitialState, executeCommand, chooseBotCommand } from '../packages/dalmuti-core/src/index.js';

const matches = Number(process.env.DALMUTI_BENCHMARK_MATCHES || 200);
const profiles = ['AGGRESSIVE', 'DEFENSIVE', 'CALCULATING', 'STRATEGIC', 'INFORMATIVE'];
const metrics = {};
for (const count of [4, 6, 8]) {
  const stats = Object.fromEntries(profiles.map((profile) => [profile, { actions: 0, passes: 0, leads: 0, leadCards: 0, finish: 0, finishes: 0, slowestMs: 0 }]));
  for (let seed = 1; seed <= matches; seed += 1) {
    const players = Array.from({ length: count }, (_, index) => ({ id: `p${index}`, nickname: `P${index}`, isHost: index === 0, isBot: true, personality: profiles[index % profiles.length] }));
    let state = createInitialState(players, { roundCount: 5, turnTimeoutSeconds: 0 }, seed);
    ({ nextState: state } = executeCommand(state, { type: 'START_MATCH', playerId: 'p0' }));
    let guard = 0;
    while (state.matchState !== 'GAME_OVER' && guard++ < 50_000) {
      if (state.matchState === 'ROUND_END') {
        state.finishOrder.forEach((id, position) => {
          const profile = state.players.find((player) => player.id === id).botProfile;
          stats[profile].finish += position + 1; stats[profile].finishes += 1;
        });
        ({ nextState: state } = executeCommand(state, { type: 'ADVANCE_ROUND', playerId: 'p0' }));
        continue;
      }
      const actorId = state.currentTurnPlayerId;
      const profile = state.players.find((player) => player.id === actorId).botProfile;
      const before = performance.now();
      const command = chooseBotCommand(state, actorId);
      stats[profile].slowestMs = Math.max(stats[profile].slowestMs, performance.now() - before);
      stats[profile].actions += 1;
      if (command.type === 'PASS') stats[profile].passes += 1;
      if (command.type === 'PLAY_SET' && state.trick.requiredCount == null) { stats[profile].leads += 1; stats[profile].leadCards += command.count; }
      ({ nextState: state } = executeCommand(state, command));
    }
    if (guard >= 50_000) throw new Error(`${count}인 ${seed}번 매치가 종료되지 않았습니다.`);
  }
  metrics[count] = Object.fromEntries(Object.entries(stats).map(([profile, value]) => [profile, {
    passRate: +(value.passes / value.actions).toFixed(3), leadSize: +(value.leadCards / value.leads).toFixed(2),
    averageFinish: +(value.finish / value.finishes).toFixed(2), slowestDecisionMs: +value.slowestMs.toFixed(2),
  }]));
}
console.log(JSON.stringify({ matches, metrics }, null, 2));
