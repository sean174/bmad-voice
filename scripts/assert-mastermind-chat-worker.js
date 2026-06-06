const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const worker = fs.readFileSync(path.join(root, 'scripts', 'mastermind-chat-worker.mjs'), 'utf8');
const queue = fs.readFileSync(path.join(root, 'api', 'mastermind-chat-jobs.js'), 'utf8');
const runbook = fs.readFileSync(path.join(root, 'docs', 'mastermind-chat-worker.md'), 'utf8');

for (const value of [
  'processOneChatJob',
  'runWorkerLoop',
  'ensureJobTable(pool)',
  'claimNextJob',
  'runClaimedJob',
  'MASTERMIND_CHAT_WORKER_POLL_MS',
  'MASTERMIND_CHAT_JOB_STALE_SECONDS',
  "process.once('SIGINT'",
  "process.once('SIGTERM'",
]) {
  assert(worker.includes(value), `worker should include ${value}`);
}

for (const value of [
  'FOR UPDATE SKIP LOCKED',
  "status = 'queued'",
  "status = 'running' AND updated_at < NOW()",
  "SET status = 'running'",
  "SET status = 'completed'",
  "SET status = 'failed'",
]) {
  assert(queue.includes(value), `queue module should include ${value}`);
}

assert(!/POSTGRES_URL.*console|ANTHROPIC_API_KEY.*console|HERMES_API_KEY.*console|MASTERMIND_BRIDGE_TOKEN.*console/.test(worker), 'worker should not print secrets');

for (const value of [
  'node scripts/mastermind-chat-worker.mjs',
  'mastermind-chat-worker.service',
  'sudo systemctl enable --now mastermind-chat-worker',
  'worker owns job execution',
  'existing Ideas capture path',
]) {
  assert(runbook.includes(value), `runbook should include ${value}`);
}

console.log('Mastermind chat worker assertions passed');
