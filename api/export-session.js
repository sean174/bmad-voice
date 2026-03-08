export default async function handler(req, res) {
  if (!process.env.POSTGRES_URL) {
    return res.status(400).json({ error: 'No database configured' });
  }

  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exported_sessions (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW(),
        picked_up BOOLEAN DEFAULT FALSE,
        summary TEXT NOT NULL,
        messages_json TEXT,
        cost NUMERIC(10,4),
        session_date TEXT
      )
    `);

    if (req.method === 'POST') {
      const { summary, messages, cost, date } = req.body;

      await pool.query(
        'INSERT INTO exported_sessions (summary, messages_json, cost, session_date) VALUES ($1, $2, $3, $4)',
        [summary || '', messages ? JSON.stringify(messages) : '[]', cost || 0, date || '']
      );

      return res.status(200).json({ exported: true });
    }

    if (req.method === 'GET') {
      const { secret } = req.query || {};
      if (secret !== process.env.SESSION_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await pool.query(
        'SELECT id, summary, cost, session_date, created_at FROM exported_sessions WHERE picked_up = FALSE ORDER BY created_at'
      );

      // Mark as picked up
      if (result.rows.length > 0) {
        const ids = result.rows.map(r => r.id);
        await pool.query('UPDATE exported_sessions SET picked_up = TRUE WHERE id = ANY($1)', [ids]);
      }

      return res.status(200).json({ sessions: result.rows });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ error: 'Failed to export' });
  } finally {
    await pool.end();
  }
}
