export default async function handler(req, res) {
  if (!process.env.POSTGRES_URL) {
    return res.status(400).json({ error: 'No database configured' });
  }

  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  try {
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_context (
        id INTEGER PRIMARY KEY DEFAULT 1,
        context_text TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP DEFAULT NOW(),
        CHECK (id = 1)
      )
    `);

    if (req.method === 'POST') {
      const { context, secret } = req.body;

      // Only allow updates with the admin secret
      if (secret !== process.env.SESSION_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await pool.query(`
        INSERT INTO admin_context (id, context_text, updated_at)
        VALUES (1, $1, NOW())
        ON CONFLICT (id) DO UPDATE SET context_text = $1, updated_at = NOW()
      `, [context || '']);

      return res.status(200).json({ saved: true, length: (context || '').length });
    }

    if (req.method === 'GET') {
      const result = await pool.query('SELECT context_text, updated_at FROM admin_context WHERE id = 1');
      if (result.rows.length === 0) {
        return res.status(200).json({ context: '', updated_at: null });
      }
      return res.status(200).json({
        context: result.rows[0].context_text,
        updated_at: result.rows[0].updated_at,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Context error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
}
