import pg from 'pg';

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('SUPABASE_DB_URL 또는 DATABASE_URL이 필요합니다.');

const actionKey = (action = {}) => `${action.type || ''}:${action.rank || ''}:${action.count || ''}:${action.jesterCount || ''}`;
const summary = () => ({ decisions: 0, passes: 0, leads: 0, leadCards: 0, jesters: 0, blocks: 0, fragments: 0, crossEntropy: 0, crossEntropyCount: 0 });
const measure = (target, trace) => {
  if (trace.eventType !== 'DECISION') return;
  target.decisions += 1;
  const selected = trace.selected || {};
  if (selected.type === 'PASS') target.passes += 1;
  if (selected.type === 'PLAY_SET') {
    target.jesters += selected.jesterCount || 0;
    if (trace.trick?.requiredCount == null) { target.leads += 1; target.leadCards += selected.count || 0; }
    if (trace.trick?.requiredCount != null && (trace.opponentHandCounts || []).some((count) => count <= 3)) target.blocks += 1;
  }
  target.fragments += Object.values(trace.handHistogram || {}).filter((count) => count === 1).length;
  if (trace.actorKind === 'HUMAN' && trace.candidateDistribution?.length) {
    const probability = trace.candidateDistribution.find((candidate) => actionKey(candidate.selected) === actionKey(selected))?.probability || 1e-6;
    target.crossEntropy -= Math.log(probability);
    target.crossEntropyCount += 1;
  }
};
const display = (value) => ({
  decisions: value.decisions,
  passRate: value.decisions ? +(value.passes / value.decisions).toFixed(3) : 0,
  leadSize: value.leads ? +(value.leadCards / value.leads).toFixed(2) : 0,
  jesterPerDecision: value.decisions ? +(value.jesters / value.decisions).toFixed(3) : 0,
  nearFinishBlockRate: value.decisions ? +(value.blocks / value.decisions).toFixed(3) : 0,
  singletonGroups: value.decisions ? +(value.fragments / value.decisions).toFixed(2) : 0,
  humanCrossEntropy: value.crossEntropyCount ? +(value.crossEntropy / value.crossEntropyCount).toFixed(3) : null,
});

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
try {
  const { rows } = await pool.query("select payload from wish_private.dalmuti_ai_decisions where created_at >= now() - interval '30 days'");
  const groups = new Map();
  for (const row of rows) {
    const trace = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    const key = trace.actorKind === 'BOT' ? `BOT:${trace.botProfile || 'UNKNOWN'}` : trace.actorKind || 'UNKNOWN';
    if (!groups.has(key)) groups.set(key, summary());
    measure(groups.get(key), trace);
  }
  console.log(JSON.stringify(Object.fromEntries([...groups].map(([key, value]) => [key, display(value)])), null, 2));
} finally {
  await pool.end();
}
