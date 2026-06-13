const COMMAND_CENTER_CONTEXT_PROBE_TIMEOUT_MS = Number(process.env.COMMAND_CENTER_CONTEXT_PROBE_TIMEOUT_MS || 10000);

function getContextData(raw) {
  return raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object'
    ? raw.data
    : raw;
}

function hasMeaningfulCommandCenterContext(raw) {
  const data = getContextData(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const metadataOnly = new Set(['generated_at', 'generatedAt', 'timestamp', 'scope', 'context_scope']);
  return Object.keys(data).some(key => {
    if (metadataOnly.has(key)) return false;
    const value = data[key];
    if (value === null || value === undefined || value === false) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  });
}

async function probeCommandCenterContext() {
  const url = process.env.COMMAND_CENTER_CONTEXT_URL || '';
  const token = process.env.MASTERMIND_BRIDGE_TOKEN || '';
  if (!url || !token) {
    return {
      attempted: false,
      reachable: false,
      authorized: false,
      hasData: false,
      status: 'not_configured',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COMMAND_CENTER_CONTEXT_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        attempted: true,
        reachable: true,
        authorized: response.status !== 401 && response.status !== 403,
        hasData: false,
        status: response.status === 401 || response.status === 403 ? 'unauthorized' : 'bad_status',
      };
    }

    const json = await response.json().catch(() => null);
    return {
      attempted: true,
      reachable: true,
      authorized: true,
      hasData: hasMeaningfulCommandCenterContext(json),
      status: json ? (hasMeaningfulCommandCenterContext(json) ? 'loaded' : 'empty') : 'invalid_json',
    };
  } catch (e) {
    return {
      attempted: true,
      reachable: false,
      authorized: false,
      hasData: false,
      status: e?.name === 'AbortError' ? 'timeout' : 'fetch_failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionAuthenticated = Boolean(
    req.headers['x-session-token']
    && process.env.SESSION_SECRET
    && req.headers['x-session-token'] === process.env.SESSION_SECRET
  );
  const bridgeProbeRequested = req.query?.bridge === '1' || req.query?.bridge === 'true';

  const checks = {
    authConfigured: Boolean(process.env.SESSION_SECRET),
    loginConfigured: Boolean(process.env.AUTH_PASSWORDS),
    commandCenterContextConfigured: Boolean(process.env.COMMAND_CENTER_CONTEXT_URL && process.env.MASTERMIND_BRIDGE_TOKEN),
    ideasBridgeConfigured: Boolean(process.env.COMMAND_CENTER_IDEAS_URL && process.env.MASTERMIND_BRIDGE_TOKEN),
    chatJobsConfigured: Boolean(process.env.POSTGRES_URL),
    hermesConfigured: Boolean(process.env.HERMES_API_BASE_URL),
  };

  if (bridgeProbeRequested && sessionAuthenticated) {
    checks.commandCenterContextLive = await probeCommandCenterContext();
  }

  return res.status(200).json({
    ok: true,
    app: 'mastermind',
    requestHost: req.headers.host || '',
    sessionAuthenticated,
    checks,
  });
}
