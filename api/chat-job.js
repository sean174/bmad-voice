import { generateChatCompletion } from './chat.js';
import { Pool } from '@neondatabase/serverless';

const JOB_STATUSES = ['queued', 'running', 'completed', 'failed'];

function createJobId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function getPool() {
  if (!process.env.POSTGRES_URL) {
    const err = new Error('No database configured');
    err.statusCode = 400;
    throw err;
  }

  return new Pool({ connectionString: process.env.POSTGRES_URL });
}

async function ensureJobTable(pool) {
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

function publicJob(row) {
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

async function fetchJob(pool, jobId) {
  const result = await pool.query(
    `SELECT job_id, session_id, user_label, status, assistant_message, error, created_at, updated_at, completed_at
     FROM mastermind_chat_jobs
     WHERE job_id = $1`,
    [jobId]
  );
  return publicJob(result.rows[0]);
}

async function createJob(pool, body) {
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

async function runJob(pool, jobId, body) {
  await pool.query(
    `UPDATE mastermind_chat_jobs
     SET status = 'running', updated_at = NOW(), error = NULL
     WHERE job_id = $1`,
    [jobId]
  );

  try {
    const result = await generateChatCompletion(body);
    await pool.query(
      `UPDATE mastermind_chat_jobs
       SET status = 'completed',
           assistant_message = $2,
           error = NULL,
           updated_at = NOW(),
           completed_at = NOW()
       WHERE job_id = $1`,
      [jobId, result.assistant_message || '']
    );
  } catch (err) {
    await pool.query(
      `UPDATE mastermind_chat_jobs
       SET status = 'failed',
           error = $2,
           updated_at = NOW(),
           completed_at = NOW()
       WHERE job_id = $1`,
      [jobId, err.message || 'Chat job failed']
    );
  }
}

export default async function handler(req, res) {
  let pool;

  try {
    pool = await getPool();
    await ensureJobTable(pool);

    if (req.method === 'GET') {
      const jobId = String(req.query?.job_id || '').trim();
      if (!jobId) return res.status(400).json({ error: 'job_id required' });

      const job = await fetchJob(pool, jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      return res.status(200).json(job);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const jobId = await createJob(pool, body);

      // Conservative Vercel first pass: this invocation does the work before returning.
      // The browser may disappear, but the completed result is persisted for resume polling.
      await runJob(pool, jobId, body);

      const job = await fetchJob(pool, jobId);
      return res.status(200).json({
        ...job,
        background_continuation: false,
        continuation_note: 'Processed during the POST invocation; a queue or Vercel waitUntil/after is needed for true background continuation after an early response.',
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: status === 500 ? 'Failed to process chat job' : err.message });
  } finally {
    if (pool) await pool.end();
  }
}

export { JOB_STATUSES };
