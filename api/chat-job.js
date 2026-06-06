import {
  JOB_STATUSES,
  createChatJobPool,
  createJob,
  ensureJobTable,
  fetchJob,
  claimJobById,
  runClaimedJob,
} from './mastermind-chat-jobs.js';

function shouldQueueForWorker() {
  return process.env.MASTERMIND_CHAT_JOB_INLINE !== 'true';
}

export default async function handler(req, res) {
  let pool;

  try {
    pool = createChatJobPool();
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
      const queuedJob = await fetchJob(pool, jobId);

      if (shouldQueueForWorker()) {
        return res.status(202).json({
          ...queuedJob,
          background_continuation: true,
          continuation_note: 'Queued for the Mastermind VPS worker. The browser can leave and poll this job later.',
        });
      }

      const claimedJob = await claimJobById(pool, jobId);
      if (claimedJob?.job_id === jobId) {
        await runClaimedJob(pool, claimedJob);
      }

      const job = await fetchJob(pool, jobId);
      return res.status(200).json({
        ...job,
        background_continuation: false,
        continuation_note: 'Processed during the POST invocation because MASTERMIND_CHAT_JOB_INLINE=true.',
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
