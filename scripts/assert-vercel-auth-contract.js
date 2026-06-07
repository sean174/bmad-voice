const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const middleware = read('middleware.js');
const index = read('public/index.html');
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
assert(index.includes("sessionToken = localStorage.getItem('bmad_token') || sessionToken"), 'lifecycle resume should restore the session token');

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
assert(chat.includes("process.env.MASTERMIND_BRIDGE_TOKEN || ''"), 'chat should read bridge token server-side');
assert(chat.includes('Authorization: `Bearer ${token}`'), 'context fetch should use server-side bearer token');
assert(chat.includes('Authorization: `Bearer ${bridgeToken}`'), 'chat idea capture should use server-side bridge token');
assert(ideas.includes('Authorization: `Bearer ${bridgeToken}`'), 'ideas endpoint should use server-side bridge token');

assert(!/process\.env\.(COMMAND_CENTER_CONTEXT_URL|COMMAND_CENTER_IDEAS_URL|MASTERMIND_BRIDGE_TOKEN|HERMES_API_KEY|HERMES_API_BASE_URL|API_SERVER_KEY|VERCEL_TOKEN|DASHBOARD_TOKEN)/.test(index), 'public HTML must not read secret or bridge env names');
assert(health.includes('Boolean(process.env.'), 'health checks should report booleans instead of env values');
assert(!/:\s*process\.env\.[A-Z0-9_]+/.test(health), 'health response must not return raw env values');

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
