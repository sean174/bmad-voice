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

export async function saveIdeaPayloadToCommandCenter(payload = {}) {
  const ideasUrl = process.env.COMMAND_CENTER_IDEAS_URL || '';
  const bridgeToken = process.env.MASTERMIND_BRIDGE_TOKEN || '';
  if (!ideasUrl || !bridgeToken) {
    const err = new Error('Ideas bridge is not connected yet.');
    err.statusCode = 503;
    throw err;
  }

  const ideaText = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (!ideaText) {
    const err = new Error('Idea text required');
    err.statusCode = 400;
    throw err;
  }

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
      session_id: payload.session_id || null,
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : {},
    }),
  });

  const raw = await response.text();
  let responsePayload = {};
  if (raw) {
    try {
      responsePayload = JSON.parse(raw);
    } catch (e) {
      responsePayload = { message: raw.slice(0, 500) };
    }
  }

  if (!response.ok) {
    const err = new Error(responsePayload.error || responsePayload.message || `Ideas bridge returned ${response.status}`);
    err.statusCode = response.status;
    err.payload = responsePayload;
    throw err;
  }

  return { status: response.status, payload: responsePayload };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { text, session_id, tags, meta } = req.body || {};

  try {
    const { status, payload } = await saveIdeaPayloadToCommandCenter({ text, session_id, tags, meta });
    return res.status(status).json(payload);
  } catch (e) {
    if (e.statusCode === 400 || e.statusCode === 503) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    console.warn('Ideas bridge request failed');
    return res.status(e.statusCode || 502).json(e.payload || { error: 'Ideas bridge request failed' });
  }
}
