export default async function handler(req, res) {
  if (!process.env.POSTGRES_URL) {
    return res.status(400).json({ error: 'No database configured' });
  }

  const { Pool } = require('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  try {
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        keywords TEXT[] NOT NULL DEFAULT '{}',
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    if (req.method === 'GET') {
      const { slug } = req.query || {};
      if (slug) {
        const result = await pool.query('SELECT id, slug, title, keywords, length(content) as content_length, created_at FROM documents WHERE slug = $1', [slug]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
        return res.json(result.rows[0]);
      }
      // List all documents (without full content to keep response small)
      const result = await pool.query('SELECT id, slug, title, keywords, length(content) as content_length, created_at FROM documents ORDER BY created_at DESC');
      return res.json({ documents: result.rows });
    }

    if (req.method === 'POST') {
      const { slug, title, keywords, content, secret } = req.body;

      if (secret !== process.env.SESSION_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!slug || !title || !keywords || !content) {
        return res.status(400).json({ error: 'slug, title, keywords, and content are required' });
      }

      await pool.query(`
        INSERT INTO documents (slug, title, keywords, content, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          keywords = EXCLUDED.keywords,
          content = EXCLUDED.content,
          updated_at = NOW()
      `, [slug, title, keywords, content]);

      return res.json({ success: true, slug });
    }

    if (req.method === 'DELETE') {
      const { slug, secret } = req.body;

      if (secret !== process.env.SESSION_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!slug) return res.status(400).json({ error: 'slug is required' });

      await pool.query('DELETE FROM documents WHERE slug = $1', [slug]);
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Documents error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await pool.end();
  }
}
