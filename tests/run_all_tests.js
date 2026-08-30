import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const testSuites = [
  { name: '1. AST Scope & Symbol Static Analyzer', file: 'tests/ast_symbol_check.test.js' },
  { name: '2. Love Letter Rule Engine Tests', file: 'tests/love_letter_rules.test.js' },
  { name: '3. Session Protection & 3-Min Reconnection Tests', file: 'tests/reconnection.test.js' },
  { name: '4. Full Multiplayer E2E Game Flow Simulation', file: 'tests/e2e_game_flow.test.js' },
];

async function runTest(suite) {
  return new Promise((resolve, reject) => {
    console.log(`\n================================================================`);
    console.log(`🚀 Executing: ${suite.name}`);
    console.log(`   Target: ${suite.file}`);
    console.log(`================================================================`);

    const child = spawn('node', [path.join(rootDir, suite.file)], {
      stdio: 'inherit',
      cwd: rootDir,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test suite [${suite.name}] failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log('\n================================================================');
  console.log('🛡️  Wish Boardgame Cafe - 4-Layer Quality Assurance Pipeline');
  console.log('================================================================');

  const startTime = Date.now();

  for (const suite of testSuites) {
    try {
      await runTest(suite);
    } catch (err) {
      console.error(`\n❌ Pipeline Aborted: ${err.message}`);
      process.exit(1);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n================================================================`);
  console.log(`🎉 ALL 4 TEST SUITES PASSED PERFECTLY in ${elapsed}s!`);
  console.log(`   - 0 Undefined Symbols / Broken JSX References`);
  console.log(`   - 100% Love Letter Card Rules Verified`);
  console.log(`   - 100% 3-Minute Pause & Reconnection Verified`);
  console.log(`   - 100% Multiplayer E2E Flow & Forfeit Verified`);
  console.log(`================================================================\n`);
  process.exit(0);
}

main();
