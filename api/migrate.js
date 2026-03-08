export default async function handler(req, res) {
  if (!process.env.POSTGRES_URL) {
    return res.status(400).json({ error: 'No database configured' });
  }

  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  try {
    await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_label TEXT DEFAULT 'unknown'");
    await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_label TEXT DEFAULT 'unknown'");
    return res.status(200).json({ success: true, message: 'Migration complete' });
  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
}
