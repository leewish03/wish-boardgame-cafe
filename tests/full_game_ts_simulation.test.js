import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import { createBotPlayer, decideBotAction } from '../server/core/AiBotController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadTs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const transformed = esbuild.transformSync(content, {
    loader: 'ts',
    target: 'node18',
    format: 'cjs',
  });
  const m = { exports: {} };
  const dirname = path.dirname(filePath);
  const customRequire = (reqPath) => {
    let resolved = path.resolve(dirname, reqPath);
    if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
      if (fs.existsSync(resolved + '.ts')) resolved += '.ts';
      else if (fs.existsSync(resolved + '.js')) resolved += '.js';
    }
    if (resolved.endsWith('.ts')) {
      return loadTs(resolved);
    }
    return require(resolved);
  };
  const fn = new Function('module', 'exports', 'require', '__dirname', '__filename', transformed.code);
  fn(m, m.exports, customRequire, dirname, filePath);
  return m.exports;
}

const root = path.resolve(__dirname, '../');
const core = loadTs(path.join(root, 'packages/love-letter-core/src/index.ts'));

console.log('🧪 Starting 10-Match Automated AI Multi-Game Simulation Testkit...');

for (let matchIdx = 1; matchIdx <= 10; matchIdx++) {
  const bots = [
    createBotPlayer([]),
    createBotPlayer([]),
    createBotPlayer([]),
    createBotPlayer([]),
  ];

  let state = core.createInitialGameState(bots, { targetTokens: 2 });
  let res = core.executeCommand(state, { type: 'START_MATCH' });
  state = res.nextState;

  let turnCount = 0;
  const maxTurns = 300;

  while (state.matchState !== 'GAME_OVER' && turnCount < maxTurns) {
    turnCount++;

    if (state.matchState === 'ROUND_END') {
      res = core.executeCommand(state, { type: 'START_ROUND' });
      state = res.nextState;
      continue;
    }

    const currentTurnPlayer = state.players.find(p => p.id === state.currentTurnPlayerId);
    if (!currentTurnPlayer || currentTurnPlayer.isEliminated) {
      break;
    }

    const botAction = decideBotAction(state, currentTurnPlayer);
    if (!botAction) break;

    res = core.executeCommand(state, {
      type: 'PLAY_CARD',
      playerId: currentTurnPlayer.id,
      cardId: botAction.cardId,
      targetId: botAction.targetId,
      guessValue: botAction.guessValue,
    });
    state = res.nextState;
  }

  assert.strictEqual(state.matchState, 'GAME_OVER', 'Match ' + matchIdx + ' must reach GAME_OVER');
  assert.ok(state.matchWinnerId, 'Match ' + matchIdx + ' must produce a valid match winner');
  const winner = state.players.find(p => p.id === state.matchWinnerId);
  console.log('  ✅ Match ' + matchIdx + '/10 Completed in ' + turnCount + ' turns. Winner: ' + winner.nickname);
}

console.log('\n🎉 ALL 10 MULTI-GAME AI SIMULATION MATCHES COMPLETED WITH 0 DEADLOCKS & 0 ERRORS!\n');
