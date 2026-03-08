const { Pool } = require('@neondatabase/serverless');

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_context (
      user_label TEXT PRIMARY KEY,
      context_text TEXT NOT NULL DEFAULT '',
      interview_complete BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Add column if table already exists without it
  await pool.query(`
    ALTER TABLE user_context ADD COLUMN IF NOT EXISTS interview_complete BOOLEAN NOT NULL DEFAULT FALSE
  `);
}

export default async function handler(req, res) {
  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'No database configured' });
  }

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  try {
    await ensureTable(pool);

    if (req.method === 'GET') {
      const { user_label } = req.query;
      if (!user_label) return res.status(400).json({ error: 'user_label required' });

      const result = await pool.query(
        'SELECT context_text, interview_complete FROM user_context WHERE user_label = $1',
        [user_label]
      );
      if (result.rows.length === 0) {
        return res.status(200).json({ context: '', is_new: true, interview_complete: false });
      }
      return res.status(200).json({
        context: result.rows[0].context_text,
        is_new: false,
        interview_complete: result.rows[0].interview_complete,
      });
    }

    if (req.method === 'POST') {
      const { user_label, context_text, append, interview_complete } = req.body;
      if (!user_label) return res.status(400).json({ error: 'user_label required' });

      // Just update the interview_complete flag without touching context
      if (interview_complete !== undefined && (!context_text || context_text === '')) {
        await pool.query(
          `INSERT INTO user_context (user_label, context_text, interview_complete, updated_at)
           VALUES ($1, '', $2, NOW())
           ON CONFLICT (user_label) DO UPDATE SET interview_complete = $2, updated_at = NOW()`,
          [user_label, !!interview_complete]
        );
        return res.status(200).json({ ok: true });
      }

      if (append && context_text) {
        const existing = await pool.query(
          'SELECT context_text FROM user_context WHERE user_label = $1',
          [user_label]
        );
        const current = existing.rows.length > 0 ? existing.rows[0].context_text : '';
        const updated = (current + '\n' + context_text).trim().substring(0, 8000);

        if (interview_complete !== undefined) {
          await pool.query(
            `INSERT INTO user_context (user_label, context_text, interview_complete, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (user_label) DO UPDATE SET context_text = $2, interview_complete = $3, updated_at = NOW()`,
            [user_label, updated, !!interview_complete]
          );
        } else {
          await pool.query(
            `INSERT INTO user_context (user_label, context_text, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_label) DO UPDATE SET context_text = $2, updated_at = NOW()`,
            [user_label, updated]
          );
        }
      } else {
        const ic = interview_complete !== undefined ? !!interview_complete : false;
        await pool.query(
          `INSERT INTO user_context (user_label, context_text, interview_complete, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_label) DO UPDATE SET context_text = $2, interview_complete = $3, updated_at = NOW()`,
          [user_label, (context_text || '').substring(0, 8000), ic]
        );
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } finally {
    await pool.end();
  }
}
