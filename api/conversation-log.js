export default async function handler(req, res) {
  if (!process.env.POSTGRES_URL) {
    return res.status(400).json({ error: 'No database configured' });
  }

  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversation_log (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_label TEXT NOT NULL,
        user_message TEXT NOT NULL,
        assistant_message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    if (req.method === 'POST') {
      const { session_id, user_label, user_message, assistant_message } = req.body;

      if (!session_id || !user_message || !assistant_message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      await pool.query(
        'INSERT INTO conversation_log (session_id, user_label, user_message, assistant_message) VALUES ($1, $2, $3, $4)',
        [session_id, user_label || 'unknown', user_message, assistant_message]
      );

      return res.status(200).json({ saved: true });
    }

    if (req.method === 'GET') {
      const { secret, date, user } = req.query || {};
      if (secret !== process.env.SESSION_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Default to today if no date provided
      let dateFilter;
      if (date) {
        dateFilter = new Date(date);
      } else {
        const now = new Date();
        dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      let query = 'SELECT session_id, user_label, user_message, assistant_message, created_at FROM conversation_log WHERE created_at >= $1 ORDER BY created_at';
      let params = [dateFilter];

      if (user) {
        query = 'SELECT session_id, user_label, user_message, assistant_message, created_at FROM conversation_log WHERE created_at >= $1 AND user_label = $2 ORDER BY created_at';
        params = [dateFilter, user];
      }

      const result = await pool.query(query, params);

      return res.status(200).json({ messages: result.rows });
    }

    if (req.method === 'DELETE') {
      const { secret, days } = req.query || {};
      if (secret !== process.env.SESSION_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const cutoffDays = parseInt(days) || 7;
      const result = await pool.query(
        'DELETE FROM conversation_log WHERE created_at < NOW() - INTERVAL \'1 day\' * $1',
        [cutoffDays]
      );

      return res.status(200).json({ deleted: result.rowCount });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Conversation log error:', err);
    return res.status(500).json({ error: 'Failed to process conversation log' });
  } finally {
    await pool.end();
  }
}
