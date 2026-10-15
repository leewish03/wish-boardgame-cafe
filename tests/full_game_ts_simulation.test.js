import { verifyLoveLetterMatches } from '../scripts/verify-gameplay-ai.js';

const report = verifyLoveLetterMatches({ seeds: 1 });
console.log(`Active Love Letter core: ${report.matches.length} seeded matches plus exact repeats; ${report.simulationCalls} rollout commands; no illegal actions or invalid inventories.`);
console.log(JSON.stringify(report, null, 2));
