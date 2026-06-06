import { Pool } from '@neondatabase/serverless';
import { generateChatCompletion } from './chat.js';

export const JOB_STATUSES = ['queued', 'running', 'completed', 'failed'];

export function createJobId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createChatJobPool() {
  if (!process.env.POSTGRES_URL) {
    const err = new Error('No database configured');
    err.statusCode = 400;
    throw err;
  }

  return new Pool({ connectionString: process.env.POSTGRES_URL });
}

export async function ensureJobTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mastermind_chat_jobs (
      id BIGSERIAL PRIMARY KEY,
      job_id TEXT UNIQUE NOT NULL,
      session_id TEXT NOT NULL,
      user_label TEXT NOT NULL DEFAULT 'unknown',
      request JSONB NOT NULL,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
      assistant_message TEXT,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP
    )
  `);
}

export function publicJob(row) {
  if (!row) return null;
  return {
    job_id: row.job_id,
    session_id: row.session_id,
    user_label: row.user_label,
    status: row.status,
    assistant_message: row.assistant_message || '',
    error: row.error || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
  };
}

export async function fetchJob(pool, jobId) {
  const result = await pool.query(
    `SELECT job_id, session_id, user_label, status, assistant_message, error, created_at, updated_at, completed_at
     FROM mastermind_chat_jobs
     WHERE job_id = $1`,
    [jobId]
  );
  return publicJob(result.rows[0]);
}

export async function createJob(pool, body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const sessionId = String(body.session_id || '').trim();
  const userLabel = String(body.user_label || 'unknown').trim() || 'unknown';
  const requestedJobId = String(body.job_id || '').trim();

  if (!sessionId) {
    const err = new Error('session_id required');
    err.statusCode = 400;
    throw err;
  }

  if (messages.length === 0) {
    const err = new Error('Messages array required');
    err.statusCode = 400;
    throw err;
  }

  const jobId = requestedJobId || createJobId();
  if (!/^[a-zA-Z0-9._:-]{8,120}$/.test(jobId)) {
    const err = new Error('Invalid job_id');
    err.statusCode = 400;
    throw err;
  }

  await pool.query(
    `INSERT INTO mastermind_chat_jobs (job_id, session_id, user_label, request, messages, status)
     VALUES ($1, $2, $3, $4, $5, 'queued')`,
    [jobId, sessionId, userLabel, JSON.stringify(body || {}), JSON.stringify(messages)]
  );

  return jobId;
}

export async function claimNextJob(pool, staleAfterSeconds = 900) {
  const result = await pool.query(
    `WITH candidate AS (
       SELECT id
       FROM mastermind_chat_jobs
       WHERE status = 'queued'
          OR (status = 'running' AND updated_at < NOW() - ($1::int * INTERVAL '1 second'))
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     UPDATE mastermind_chat_jobs AS job
     SET status = 'running',
         updated_at = NOW(),
         completed_at = NULL,
         error = NULL
     FROM candidate
     WHERE job.id = candidate.id
     RETURNING job.id, job.job_id, job.session_id, job.user_label, job.request, job.messages, job.status, job.created_at, job.updated_at`,
    [staleAfterSeconds]
  );

  return result.rows[0] || null;
}

export async function claimJobById(pool, jobId) {
  const result = await pool.query(
    `UPDATE mastermind_chat_jobs
     SET status = 'running',
         updated_at = NOW(),
         completed_at = NULL,
         error = NULL
     WHERE job_id = $1
       AND status = 'queued'
     RETURNING id, job_id, session_id, user_label, request, messages, status, created_at, updated_at`,
    [jobId]
  );

  return result.rows[0] || null;
}

export async function markJobCompleted(pool, jobId, assistantMessage) {
  await pool.query(
    `UPDATE mastermind_chat_jobs
     SET status = 'completed',
         assistant_message = $2,
         error = NULL,
         updated_at = NOW(),
         completed_at = NOW()
     WHERE job_id = $1`,
    [jobId, assistantMessage || '']
  );
}

export async function markJobFailed(pool, jobId, message) {
  await pool.query(
    `UPDATE mastermind_chat_jobs
     SET status = 'failed',
         error = $2,
         updated_at = NOW(),
         completed_at = NOW()
     WHERE job_id = $1`,
    [jobId, message || 'Chat job failed']
  );
}

export async function runClaimedJob(pool, job) {
  try {
    const result = await generateChatCompletion(job.request || {});
    await markJobCompleted(pool, job.job_id, result.assistant_message || '');
    return { status: 'completed', job_id: job.job_id };
  } catch (err) {
    await markJobFailed(pool, job.job_id, err.message || 'Chat job failed');
    return { status: 'failed', job_id: job.job_id };
  }
}
