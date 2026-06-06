#!/usr/bin/env node

import {
  claimNextJob,
  createChatJobPool,
  ensureJobTable,
  runClaimedJob,
} from '../api/mastermind-chat-jobs.js';

const DEFAULT_POLL_INTERVAL_MS = 2500;
const DEFAULT_STALE_AFTER_SECONDS = 15 * 60;

function readPositiveInt(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function processOneChatJob(pool, staleAfterSeconds = DEFAULT_STALE_AFTER_SECONDS) {
  const job = await claimNextJob(pool, staleAfterSeconds);
  if (!job) return null;

  console.info('Mastermind worker claimed job', { job_id: job.job_id, status: 'running' });
  const result = await runClaimedJob(pool, job);
  console.info('Mastermind worker finished job', { job_id: job.job_id, status: result.status });
  return result;
}

export async function runWorkerLoop({
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  staleAfterSeconds = DEFAULT_STALE_AFTER_SECONDS,
  stopSignal = () => false,
} = {}) {
  const pool = createChatJobPool();

  try {
    await ensureJobTable(pool);
    console.info('Mastermind chat worker started');

    while (!stopSignal()) {
      const result = await processOneChatJob(pool, staleAfterSeconds);
      if (!result) await sleep(pollIntervalMs);
    }
  } finally {
    await pool.end();
    console.info('Mastermind chat worker stopped');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let stopping = false;
  const stop = () => {
    stopping = true;
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  runWorkerLoop({
    pollIntervalMs: readPositiveInt('MASTERMIND_CHAT_WORKER_POLL_MS', DEFAULT_POLL_INTERVAL_MS),
    staleAfterSeconds: readPositiveInt('MASTERMIND_CHAT_JOB_STALE_SECONDS', DEFAULT_STALE_AFTER_SECONDS),
    stopSignal: () => stopping,
  }).catch(err => {
    console.error('Mastermind chat worker failed', { message: err.message || 'unknown error' });
    process.exitCode = 1;
  });
}
