const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const middleware = read('middleware.js');
const vercel = read('vercel.json');
const index = read('public/index.html');
const manifest = read('public/manifest.json');
const chat = read('api/chat.js');
const ideas = read('api/ideas.js');
const health = read('api/health.js');

assert(middleware.includes("url.pathname === '/api/login'"), 'login route should remain public');
assert(middleware.includes("url.pathname === '/api/health'"), 'health route should remain public');
assert(middleware.includes("request.headers.get('x-session-token')"), 'middleware should require x-session-token');
assert(middleware.includes('process.env.SESSION_SECRET'), 'middleware should validate against SESSION_SECRET');

const protectedApiCalls = [
  "apiFetch('/api/ideas'",
  "apiFetch('/api/conversation-log'",
  'apiFetch(`/api/chat-job?job_id=${encodeURIComponent(pending.job_id)}`)',
  "apiFetch('/api/chat-job'",
  "apiFetch('/api/chat'",
  "apiFetch('/api/speak'",
  "apiFetch('/api/usage'",
  "apiFetch('/api/user-context'",
];

for (const call of protectedApiCalls) {
  assert(index.includes(call), `protected browser call should use apiFetch: ${call}`);
}

assert(index.includes("'x-session-token': sessionToken"), 'apiFetch should attach x-session-token');
assert(index.includes('async function apiFetch'), 'apiFetch should inspect protected responses');
assert(index.includes('if (response.status === 401) handleUnauthorizedSession()'), 'apiFetch should reset stale sessions on 401');
assert(index.includes('function clearStoredSession()'), 'browser should have a scoped session clear helper');
assert(index.includes("localStorage.removeItem('bmad_token')"), 'stale token reset should remove bmad_token');
assert(index.includes('function validateSavedSession()'), 'saved localStorage sessions should be validated');
assert(index.includes('/api/chat-job?job_id=session-check-probe'), 'saved session validation should use a protected same-origin probe');
assert(index.includes('const APP_VERSION'), 'browser should expose a visible build/version stamp');
assert(index.includes('function resetAppSession()'), 'browser should have an explicit reset/session recovery helper');
assert(index.includes("new URLSearchParams(window.location.search).get('reset') === '1'"), 'browser should support ?reset=1 recovery');
assert(index.includes('sessionStorage.clear()'), 'reset recovery should clear sessionStorage');
assert(index.includes("url.searchParams.set('t', Date.now().toString(36))"), 'reset recovery should reload with a cache-busting query');
assert(index.includes('Session accepted. Build'), 'saved session probe should explain expected diagnostic statuses');
assert(index.includes("fetch('/api/health?bridge=1'"), 'browser should show non-secret health diagnostics');
assert(index.includes("'x-session-token': sessionToken"), 'health diagnostic should send the session token for the bridge probe');
assert(index.includes("sessionToken = localStorage.getItem('bmad_token') || sessionToken"), 'lifecycle resume should restore the session token');
assert(manifest.includes('"start_url": "/?v=2026-06-13-2"'), 'PWA start_url should carry the current shell version');
assert(!manifest.includes('voice.html'), 'PWA start_url should open the current chat UI, not the legacy voice page');

for (const source of ['"source": "/"', '"source": "/index.html"', '"source": "/voice.html"', '"source": "/manifest.json"']) {
  assert(vercel.includes(source), `vercel headers should include ${source}`);
}
assert(vercel.includes('"key": "Cache-Control"'), 'vercel config should set cache-control headers');
assert(vercel.includes('"value": "no-store, max-age=0"'), 'HTML and manifest should be no-store for mobile/PWA recovery');

const publicApiCalls = [
  "fetch('/api/login'",
  "fetch('/api/waitlist'",
];

for (const call of publicApiCalls) {
  assert(index.includes(call), `known public browser call should remain explicit: ${call}`);
}

const publicBundleForbidden = [
  'MASTERMIND_BRIDGE_TOKEN',
  'HERMES_API_KEY',
  'HERMES_API_BASE_URL',
  'API_SERVER_KEY',
  'VERCEL_TOKEN',
  'DASHBOARD_TOKEN',
];

for (const value of publicBundleForbidden) {
  assert(!index.includes(value), `public HTML must not reference ${value}`);
}

assert(chat.includes("process.env.COMMAND_CENTER_CONTEXT_URL || ''"), 'chat should read Command Center context URL server-side');
assert(ideas.includes("process.env.MASTERMIND_BRIDGE_TOKEN || ''"), 'ideas save helper should read bridge token server-side');
assert(chat.includes("import { saveIdeaPayloadToCommandCenter } from './ideas.js';"), 'chat idea capture should reuse the server-side ideas save helper');
assert(chat.includes('Authorization: `Bearer ${token}`'), 'context fetch should use server-side bearer token');
assert(ideas.includes('Authorization: `Bearer ${bridgeToken}`'), 'ideas endpoint should use server-side bridge token');
assert(chat.includes('safeContextDiagnostics'), 'chat should expose only safe context diagnostics');
assert(chat.includes('projects_sorted_by_rank'), 'chat should preserve ranked project context in compact mode');
assert(chat.includes('business_context_docs_excerpts'), 'chat should preserve concise business doc excerpts in compact mode');
assert(chat.includes('do not say you lack the full operational picture'), 'chat should instruct the model not to deny loaded Command Center context');

assert(!/process\.env\.(COMMAND_CENTER_CONTEXT_URL|COMMAND_CENTER_IDEAS_URL|MASTERMIND_BRIDGE_TOKEN|HERMES_API_KEY|HERMES_API_BASE_URL|API_SERVER_KEY|VERCEL_TOKEN|DASHBOARD_TOKEN)/.test(index), 'public HTML must not read secret or bridge env names');
assert(health.includes('Boolean(process.env.'), 'health checks should report booleans instead of env values');
assert(!/:\s*process\.env\.[A-Z0-9_]+/.test(health), 'health response must not return raw env values');
assert(health.includes('probeCommandCenterContext'), 'health should include a session-gated Command Center bridge probe');
assert(health.includes('COMMAND_CENTER_CONTEXT_PROBE_TIMEOUT_MS'), 'health bridge probe should use a named, configurable timeout');
assert(health.includes("req.query?.bridge === '1'"), 'bridge probe should be explicitly requested');
assert(health.includes('sessionAuthenticated'), 'health should report whether the supplied session token matched');
assert(health.includes('commandCenterContextLive'), 'health should expose non-secret live context bridge status');
assert(chat.includes('CC_CONTEXT_FETCH_TIMEOUT_MS'), 'chat context bridge fetch should use a named, configurable timeout');

for (const key of [
  'authConfigured',
  'loginConfigured',
  'commandCenterContextConfigured',
  'ideasBridgeConfigured',
  'chatJobsConfigured',
  'hermesConfigured',
]) {
  assert(health.includes(key), `health should include non-secret ${key} boolean`);
}

console.log('Vercel auth contract assertions passed');
