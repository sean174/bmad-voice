const { Pool } = require('@neondatabase/serverless');

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_context (
      user_label TEXT PRIMARY KEY,
      context_text TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW()
    )
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
        'SELECT context_text FROM user_context WHERE user_label = $1',
        [user_label]
      );
      const context = result.rows.length > 0 ? result.rows[0].context_text : '';
      return res.status(200).json({ context, is_new: result.rows.length === 0 });
    }

    if (req.method === 'POST') {
      const { user_label, context_text, append } = req.body;
      if (!user_label) return res.status(400).json({ error: 'user_label required' });

      if (append && context_text) {
        // Append new memories to existing context
        const existing = await pool.query(
          'SELECT context_text FROM user_context WHERE user_label = $1',
          [user_label]
        );
        const current = existing.rows.length > 0 ? existing.rows[0].context_text : '';
        const updated = (current + '\n' + context_text).trim().substring(0, 8000);

        await pool.query(
          `INSERT INTO user_context (user_label, context_text, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_label) DO UPDATE SET context_text = $2, updated_at = NOW()`,
          [user_label, updated]
        );
      } else {
        // Full replace
        await pool.query(
          `INSERT INTO user_context (user_label, context_text, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_label) DO UPDATE SET context_text = $2, updated_at = NOW()`,
          [user_label, (context_text || '').substring(0, 8000)]
        );
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } finally {
    await pool.end();
  }
}
