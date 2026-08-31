import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const testSuites = [
  { name: '1. AST Scope & Symbol Static Analyzer', file: 'tests/ast_symbol_check.test.js' },
  { name: '2. Section 47: Love Letter Core 17 Unit Tests', file: 'tests/core/core_rules.test.js' },
  { name: '3. Server Rule Engine Unit Tests', file: 'tests/love_letter_rules.test.js' },
  { name: '4. AI Bot Memory & Heuristics Tests', file: 'tests/ai_bot_heuristics.test.js' },
  { name: '5. Section 48: 200-Game Property/Simulation Invariants Tests', file: 'tests/simulation.test.js' },
  { name: '6. Section 49: Socket Integration Tests (Real Sockets)', file: 'tests/socket_integration.test.js' },
  { name: '6.1 Typed Protocol Controller Integration', file: 'tests/protocol_socket_integration.test.js' },
  { name: '7. Section 50: Secret Leakage Security Tests (0-Leak Verification)', file: 'tests/secret_leakage.test.js' },
  { name: '8. Section 51: Reconnect Network Integration Tests', file: 'tests/reconnect_integration.test.js' },
  { name: '9. Disconnect Recovery & State Resync Tests', file: 'tests/disconnect_recovery.test.js' },
  { name: '10. 10-Match Automated Multi-Game Testkit', file: 'tests/full_game_ts_simulation.test.js' },
];

async function runTest(suite) {
  return new Promise((resolve, reject) => {
    console.log('\n================================================================');
    console.log('🚀 Executing: ' + suite.name);
    console.log('   Target: ' + suite.file);
    console.log('================================================================');

    const child = spawn('node', [path.join(rootDir, suite.file)], {
      stdio: 'inherit',
      cwd: rootDir,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Test suite [' + suite.name + '] failed with exit code ' + code));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log('\n================================================================');
  console.log('🛡️  Wish Boardgame Cafe - Complete QA & Test Pipeline');
  console.log('================================================================');

  const startTime = Date.now();

  for (const suite of testSuites) {
    try {
      await runTest(suite);
    } catch (err) {
      console.error('\n❌ Pipeline Aborted: ' + err.message);
      process.exit(1);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n================================================================');
  console.log(`🎉 ALL ${testSuites.length} TEST SUITES PASSED PERFECTLY in ${elapsed}s!`);
  console.log('   - 0 Undefined Symbols / Broken TSX References');
  console.log('   - Section 47: 17 Core Card Rules Verified (100%)');
  console.log('   - Section 48: 200 Multi-Game Simulation Invariants Verified (100%)');
  console.log('   - Section 49: Socket Integration Real Flow Verified (100%)');
  console.log('   - Section 50: Secret Leakage 0 Leaks Confirmed (100%)');
  console.log('   - Section 51: Reconnect Network Integration Verified (100%)');
  console.log('   - AI Bot Priest Memory & Heuristics Verified');
  console.log('   - Disconnect Recovery & State Resync Verified');
  console.log('================================================================\n');
  process.exit(0);
}

main();
