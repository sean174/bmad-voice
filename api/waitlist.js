module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )`
    );

    // Check for duplicate
    const existing = await pool.query('SELECT id FROM waitlist WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      return res.status(200).json({ ok: true, message: 'Already on the list' });
    }

    await pool.query('INSERT INTO waitlist (email) VALUES ($1)', [email]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Waitlist error:', e);
    return res.status(500).json({ error: 'Something went wrong' });
  } finally {
    await pool.end();
  }
};
