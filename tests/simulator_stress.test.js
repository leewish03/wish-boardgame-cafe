import { LoveLetterSimulator } from '../packages/testkit/src/index.js';

console.log('🧪 Starting 100-Match Automated AI Stress Simulation via @wish/testkit...\n');

const results = LoveLetterSimulator.runBatch({
  matchCount: 100,
  playerCount: 4,
  targetTokens: 4,
  maxTurnsPerMatch: 300,
});

console.log(`📊 Simulation Completed:
  - Matches Run: ${results.matchCount}
  - Total Rounds: ${results.totalRounds}
  - Total Turns: ${results.totalTurns}
  - Average Turns per Round: ${results.averageTurnsPerRound}
  - Deadlocks: ${results.deadlocks}
  - Invariant Failures: ${results.invariantFailures.length}
  - Winner Distribution: ${JSON.stringify(results.winners)}
`);

if (results.deadlocks > 0 || results.invariantFailures.length > 0) {
  console.error('❌ Stress Test Failed with Invariant Violations:');
  results.invariantFailures.slice(0, 10).forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
} else {
  console.log('✅ ALL 100 MATCHES PASSED WITH 0 DEADLOCKS AND 0 INVARIANT FAILURES!\n');
}
