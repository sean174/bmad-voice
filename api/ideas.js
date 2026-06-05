function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

function isAuthorized(req) {
  const expected = process.env.SESSION_SECRET || '';
  if (!expected) return false;

  const bodyToken = req.body?.token || '';
  const bearerToken = getBearerToken(req);
  const headerToken = req.headers['x-session-token'] || '';

  return bodyToken === expected || bearerToken === expected || headerToken === expected;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ideasUrl = process.env.COMMAND_CENTER_IDEAS_URL || '';
  const bridgeToken = process.env.MASTERMIND_BRIDGE_TOKEN || '';
  if (!ideasUrl || !bridgeToken) {
    return res.status(503).json({ error: 'Ideas bridge is not connected yet.' });
  }

  const { text, session_id, tags, meta } = req.body || {};
  const ideaText = typeof text === 'string' ? text.trim() : '';
  if (!ideaText) {
    return res.status(400).json({ error: 'Idea text required' });
  }

  try {
    const response = await fetch(ideasUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bridgeToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        text: ideaText,
        source: 'mastermind-vercel',
        session_id: session_id || null,
        tags: Array.isArray(tags) ? tags : [],
        meta: meta && typeof meta === 'object' ? meta : {},
      }),
    });

    const raw = await response.text();
    let payload = {};
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch (e) {
        payload = { message: raw.slice(0, 500) };
      }
    }

    return res.status(response.status).json(payload);
  } catch (e) {
    console.warn('Ideas bridge request failed');
    return res.status(502).json({ error: 'Ideas bridge request failed' });
  }
}
