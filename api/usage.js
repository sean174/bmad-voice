export default async function handler(req, res) {
  if (req.method === 'POST') {
    return handleSaveSession(req, res);
  }
  if (req.method === 'GET') {
    return handleGetUsage(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleSaveSession(req, res) {

  if (!process.env.POSTGRES_URL) {
    return res.status(200).json({ saved: false, reason: 'No database configured' });
  }

  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  const {
    started_at,
    ended_at,
    total_input_tokens,
    total_output_tokens,
    total_cartesia_characters,
    estimated_cost_usd,
    summary_text,
    messages_json,
    user_label,
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO sessions
        (started_at, ended_at, total_input_tokens, total_output_tokens,
         total_cartesia_characters, estimated_cost_usd, summary_text, messages_json, user_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        started_at, ended_at, total_input_tokens || 0, total_output_tokens || 0,
        total_cartesia_characters || 0, estimated_cost_usd || 0,
        summary_text || '', messages_json ? JSON.stringify(messages_json) : '[]',
        user_label || 'unknown',
      ]
    );

    return res.status(200).json({ saved: true });
  } catch (err) {
    console.error('Save session error:', err);
    return res.status(500).json({ error: 'Failed to save session' });
  } finally {
    await pool.end();
  }
}

async function handleGetUsage(req, res) {
  if (!process.env.POSTGRES_URL) {
    return res.status(200).json({ available: false });
  }

  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const monthly = await pool.query(
      `SELECT
        COUNT(*) as session_count,
        COALESCE(SUM(total_input_tokens), 0) as input_tokens,
        COALESCE(SUM(total_output_tokens), 0) as output_tokens,
        COALESCE(SUM(total_cartesia_characters), 0) as cartesia_chars,
        COALESCE(SUM(estimated_cost_usd), 0) as total_cost
       FROM sessions WHERE started_at > $1`,
      [monthStart]
    );

    const today = await pool.query(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) as today_cost
       FROM sessions WHERE started_at > $1`,
      [dayStart]
    );

    const messagesToday = await pool.query(
      'SELECT COUNT(*) as cnt FROM messages WHERE created_at > $1',
      [dayStart]
    );

    const cap = parseFloat(process.env.MONTHLY_SPEND_CAP_USD) || 50;

    return res.status(200).json({
      available: true,
      monthly: {
        sessions: parseInt(monthly.rows[0].session_count),
        inputTokens: parseInt(monthly.rows[0].input_tokens),
        outputTokens: parseInt(monthly.rows[0].output_tokens),
        cartesiaCharacters: parseInt(monthly.rows[0].cartesia_chars),
        totalCost: parseFloat(parseFloat(monthly.rows[0].total_cost).toFixed(4)),
        cap,
        percentUsed: Math.round((parseFloat(monthly.rows[0].total_cost) / cap) * 100),
      },
      today: {
        cost: parseFloat(parseFloat(today.rows[0].today_cost).toFixed(4)),
        messages: parseInt(messagesToday.rows[0].cnt),
      },
    });
  } catch (err) {
    console.error('Usage query error:', err);
    return res.status(500).json({ error: 'Failed to get usage' });
  } finally {
    await pool.end();
  }
}
