import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import net from 'node:net';
import { io } from 'socket.io-client';
import * as nimmt from '../packages/six-nimmt-core/src/index.js';
import * as hall from '../packages/whitehall-core/src/index.js';
import * as chapel from '../packages/whitechapel-core/src/index.js';

const production = process.argv.includes('--production-smoke');
const postgres = process.argv.includes('--postgres');
const count = production ? 3 : Number(process.argv.slice(2).find(arg => /^\d+$/.test(arg)) || 12);
const databaseUrl = postgres ? process.env.RELIABILITY_DATABASE_URL : '';
if (postgres) assert.ok(!production && databaseUrl && ['127.0.0.1', 'localhost'].includes(new URL(databaseUrl).hostname), 'SQL load tests require an isolated loopback database');
assert.ok(Number.isInteger(count) && count >= 3 && count <= 48, 'Use 3..48 isolated rooms');
let url = 'https://playwish.onrender.com';
const duration = production ? 15000 : 30000;
const types = ['SIX_NIMMT', 'WHITEHALL', 'WHITECHAPEL'];
const cores = { SIX_NIMMT: nimmt, WHITEHALL: hall, WHITECHAPEL: chapel };
const sockets = [], rooms = [], timings = [], failures = [], health = [], errors = [];
let app;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function emit(client, event, payload = {}) {
  const start = performance.now();
  const result = await new Promise((resolve, reject) => client.timeout(5000).emit(event, payload, (error, value) => error ? reject(error) : resolve(value)));
  timings.push({ event, ms: performance.now() - start });
  return result;
}
async function connect() {
  const client = io(url, { transports: ['websocket'], reconnection: false, timeout: 5000 });
  sockets.push(client);
  await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
  return client;
}
function choose(type, state, id) {
  if (type === 'WHITEHALL' && !hall.getPendingActors(state.game).includes(id)) return null;
  const observation = type === 'SIX_NIMMT' ? { ...state.game, mySecret: state.mySecret, playerId: id }
    : type === 'WHITEHALL' ? { public: state.game, private: state.mySecret } : { game: state.game, mySecret: state.mySecret };
  return cores[type].chooseBotCommand(observation, id);
}
const ok = result => assert.equal(result?.success, true, result?.error);
let aborted = false;
try {
  if (!production) {
    const reservation = net.createServer();
    await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    url = `http://127.0.0.1:${port}`;
    app = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), SUPABASE_DB_URL: databaseUrl, DATABASE_URL: '', DOTENV_CONFIG_PATH: 'output/reliability/no-env' }, stdio: ['ignore', 'ignore', 'pipe'] });
    app.stderr.on('data', data => errors.push(data.toString().slice(0, 1000)));
    let ready = false;
    for (let i = 0; i < 100; i++) { assert.equal(app.exitCode, null, 'test server must stay alive'); try { ready = (await fetch(`${url}/api/health`)).ok; } catch {} if (ready) break; await wait(100); }
    assert.ok(ready, 'isolated server starts');
  }
  // At most three simultaneous setups on production; no real users are joined.
  await Promise.all(Array.from({ length: count }, async (_, index) => {
    const type = types[index % types.length], client = await connect();
    const entry = { client, type, state: null, actions: 0, versions: new Set() };
    client.on('room:state', state => { entry.state = state; if (state.game) entry.versions.add(state.stateVersion); });
    const created = await emit(client, 'room:create', { gameType: type, nickname: 'Release load QA', maxPlayers: 2, turnTimeLimit: 0 });
    ok(created); Object.assign(entry, { code: created.roomCode, id: created.userId }); rooms.push(entry);
    ok(await emit(client, 'room:add-bot', { roomCode: entry.code }));
    ok(await emit(client, 'board:start', { roomCode: entry.code }));
  }));
  const deadline = Date.now() + duration;
  const monitor = (async () => {
    while (!aborted && Date.now() < deadline) {
      const start = performance.now();
      try { const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(3000) }); health.push({ ms: performance.now() - start, status: response.status }); if (!response.ok) aborted = true; }
      catch { health.push({ status: 0 }); aborted = true; }
      await wait(1000);
    }
  })();
  await Promise.all(rooms.map(async entry => {
    try {
      while (!aborted && Date.now() < deadline) {
        const state = entry.state;
        if (!state?.game) { await wait(100); continue; }
        if (state.presentation.pending) {
          ok(await emit(entry.client, 'board:presentation-ack', { roomCode: entry.code, eventId: state.presentation.id }));
        } else if (state.gameState === 'GAME_OVER') break;
        else {
          const command = choose(entry.type, state, entry.id);
          if (command) {
            const result = await emit(entry.client, 'board:command', { roomCode: entry.code, command, expectedVersion: state.stateVersion });
            if (result.success) entry.actions++;
            else if (!/지난 상태|표시하는 중/.test(result.error || '')) throw new Error(result.error || 'command failed');
          }
        }
        await wait(production ? 400 : 60);
      }
    } catch (error) { failures.push({ type: entry.type, error: error.message }); aborted = true; }
  }));
  await monitor;
} finally {
  for (const room of rooms) {
    try { ok(await emit(room.client, 'room:leave', { roomCode: room.code })); } catch (error) { failures.push({ cleanup: room.type, error: error.message }); }
  }
  for (const socket of sockets) socket.disconnect();
  if (app?.exitCode === null) { const exit = once(app, 'exit'); app.kill(); await exit; }
  const ordered = timings.map(row => row.ms).sort((a, b) => a - b);
  const report = { target: production ? 'production bounded smoke' : `isolated ${postgres ? 'PostgreSQL' : 'memory'} server`, rooms: count, durationMs: duration,
    requests: timings.length, latencyMs: { p50: ordered[Math.floor(ordered.length * .5)], p95: ordered[Math.floor(ordered.length * .95)], max: ordered.at(-1) },
    games: rooms.map(({ type, actions, versions }) => ({ type, actions, observedVersions: versions.size })), health, failures, serverErrors: errors };
  await mkdir('output/reliability', { recursive: true });
  await writeFile(`output/reliability/load-${production ? 'production' : postgres ? `postgres-${count}` : count}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
assert.equal(failures.length, 0, 'all commands and cleanup succeed');
assert.equal(aborted, false, 'health remained available');
assert.ok(rooms.every(room => room.actions > 0 && room.versions.size > 2), 'each game made observable progress');
