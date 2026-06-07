const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const chatPath = path.join(__dirname, '..', 'api', 'chat.js');
const source = fs.readFileSync(chatPath, 'utf8')
  .replace(/^import\s+\{\s*Pool\s*\}\s+from\s+'@neondatabase\/serverless';\n/m, '')
  .replace(/^export\s+async\s+function\s+generateChatCompletion/m, 'async function generateChatCompletion')
  .replace(/^export\s+default\s+async\s+function\s+handler/m, 'async function handler');

const context = {
  console,
  process: { env: {} },
  require,
  fetch: async () => {
    throw new Error('fetch should not be called by mode assertions');
  },
  TextDecoder,
};

vm.runInNewContext(`${source}
this.SYSTEM_PROMPT = SYSTEM_PROMPT;
this.buildHermesSystemMessage = buildHermesSystemMessage;
this.resolveRequestMode = resolveRequestMode;
this.isFastModeEscalationRequest = isFastModeEscalationRequest;
this.formatCommandCenterContext = formatCommandCenterContext;
this.formatCompactCommandCenterContext = formatCompactCommandCenterContext;`, context, {
  filename: chatPath,
});

assert(context.SYSTEM_PROMPT.includes('You are Mastermind'));
assert(context.SYSTEM_PROMPT.includes('CEO coach layer'));
assert(context.SYSTEM_PROMPT.includes('Elevated Advisor'));
assert(context.SYSTEM_PROMPT.includes('90-day goals'));
assert(context.SYSTEM_PROMPT.includes('Push delegation'));
assert(context.SYSTEM_PROMPT.includes('Mastermind Business Owner Pack'));
assert(context.SYSTEM_PROMPT.includes('strategy-filter'));
assert(context.SYSTEM_PROMPT.includes('roadblock-unblocker'));
assert(context.SYSTEM_PROMPT.includes('highest-leverage-activity'));
assert(context.SYSTEM_PROMPT.includes('Ideas capture is the only allowed write path.'));
assert(context.SYSTEM_PROMPT.includes('You cannot create tasks, update Asana, update Command Center projects'));
assert(context.SYSTEM_PROMPT.includes('When live Command Center context is present, do not say you lack the full operational picture.'));

const hermesSystem = context.buildHermesSystemMessage('test prompt');
assert(hermesSystem.includes('Mastermind voice interface with a CEO coach layer'));
assert(hermesSystem.includes('Do not mutate Command Center projects, operations, decisions, delegations, or instructions.'));
assert(hermesSystem.includes('Decision and delegation handoffs are draft text only.'));
assert(hermesSystem.includes('Mastermind Business Owner Pack modules'));
assert(hermesSystem.includes('GHL/SMS/Slack/Google/Asana/Vercel'));

assert.strictEqual(context.resolveRequestMode({}, 'what should I focus on today?'), 'fast');
assert.strictEqual(context.resolveRequestMode({ mode: 'fast' }, 'review the files'), 'fast');
assert.strictEqual(context.resolveRequestMode({ mode: 'deep' }, 'quick thought'), 'deep');
assert.strictEqual(context.resolveRequestMode({ mode: 'operator' }, 'quick thought'), 'operator');
assert.strictEqual(context.resolveRequestMode({}, 'debug the deployment config'), 'deep');

assert.strictEqual(context.isFastModeEscalationRequest('debug the deployment config'), true);
assert.strictEqual(context.isFastModeEscalationRequest('what should I focus on today?'), false);

const compact = context.formatCompactCommandCenterContext({
  data: {
    generated_at: '2026-06-05T00:00:00Z',
    scope: 'test',
    sources: [{ name: 'Projects DB', updated_at: '2026-06-04T12:00:00Z' }],
    source_timestamps: { projects: '2026-06-04T12:00:00Z' },
    kpi_headlines: { revenue: '$1' },
    current_priorities: {
      top_priorities: ['Protect Command Center access', 'Advance advisor sales bot'],
      current_constraint: 'Travel access is blocking normal Command Center work.',
      weekly_focus: 'Restore secure access and keep revenue projects moving.',
      do_not_distract: ['Low-leverage UI polish'],
      last_context_refresh: '2026-06-04T11:55:00Z',
    },
    projects_sorted_by_rank: false,
    projects: [
      { rank: 1, name: 'Command Center Security + Travel Access', status: 'blocked', owner: 'Sean', priority: 'P0', summary: 'Restore secure travel access', next_step: 'Verify locked-down bridge', id: 'proj-sec-travel' },
      { rank: 2, name: 'Advisor Intent Router + Sales Bot', status: 'active', owner: 'Sean', priority: 'P1', summary: 'Route buyer intent into sales bot', next_step: 'Review routing logic', id: 'proj-intent-router' },
      { rank: 4, name: 'SMS Bot to Aged Roth Leads', status: 'active', owner: 'Sean', priority: 'P2', summary: 'Revive aged Roth leads', next_step: 'Check reply quality', id: 'proj-aged-roth' },
    ],
    top_projects: [{ title: 'Enrollment Sprint', priority: 'P1', summary: 'Fill advisor pipeline' }],
    blockers: [{ title: 'Blocked launch', blocked_on: 'approval' }],
    pending_decisions: [{ title: 'Choose offer', question: 'A or B?' }],
    active_operations: [{ title: 'Launch', status: 'active' }],
    recent_dashboard_events: [{ title: 'Dashboard refreshed', summary: 'New reply quality signal' }],
    tools_context: { asana: 'read-only', ghl: 'read-only' },
    newest_ideas: [{ text: 'Fast briefing' }],
    business_context_docs: [{ title: 'Operating Brief', excerpt: 'Elevated Advisor serves independent financial advisors.' }],
  },
});

assert(compact.includes('generated_at: 2026-06-05T00:00:00Z'));
assert(compact.includes('sources:'));
assert(compact.includes('source_timestamps:'));
assert(compact.includes('current_priorities:'));
assert(compact.includes('top_priorities: ["Protect Command Center access","Advance advisor sales bot"]'));
assert(compact.includes('current_constraint: Travel access is blocking normal Command Center work.'));
assert(compact.includes('weekly_focus: Restore secure access and keep revenue projects moving.'));
assert(compact.includes('do_not_distract: ["Low-leverage UI polish"]'));
assert(compact.includes('ranked_projects_from_command_center:'));
assert(compact.includes('rank: 1 | name: Command Center Security + Travel Access | status: blocked'));
assert(compact.includes('rank: 2 | name: Advisor Intent Router + Sales Bot | status: active'));
assert(compact.includes('rank: 4 | name: SMS Bot to Aged Roth Leads | status: active'));
assert(compact.includes('instruction: If Sean asks for top projects'));
assert(compact.includes('projects_sorted_by_rank:'));
assert(compact.includes('- none provided'));
assert(compact.includes('top_projects:'));
assert(compact.includes('Enrollment Sprint'));
assert(compact.includes('recent_dashboard_events:'));
assert(compact.includes('Dashboard refreshed'));
assert(compact.includes('tools_context:'));
assert(compact.includes('asana: read-only'));
assert(compact.includes('newest_ideas:'));
assert(compact.includes('business_context_docs_excerpts:'));
assert(compact.includes('Operating Brief'));
assert(compact.length <= 12000);

const full = context.formatCommandCenterContext({
  data: {
    generatedAt: '2026-06-06T10:00:00Z',
    context_scope: 'full-business',
    command_center_state: {
      summary: 'Command Center is focused on acquisition and delivery capacity.',
      top_projects: [{ name: 'Advisor Pipeline', priority: 'P1', status: 'active', owner: 'Sean' }],
      active_operations: [{ name: 'Outbound System', status: 'running', next_step: 'Review reply quality' }],
      blockers: [{ name: 'Calendar Show Rate', blocked_on: 'appointment quality' }],
      pending_decisions: [{ name: 'Offer Packaging', question: 'Keep premium tier?' }],
      recent_dashboard_events: [{ name: 'Dashboard Event', summary: 'Pipeline status changed' }],
      recent_ideas: [{ text: 'Build pre-call proof packet', source: 'Mastermind' }],
      source_timestamps: { ghl: '2026-06-06T09:00:00Z', asana: '2026-06-06T08:30:00Z' },
    },
    current_priorities: {
      top_priorities: ['Grow qualified appointments', 'Protect delivery capacity'],
      current_constraint: 'Show rate needs qualification improvements.',
      weekly_focus: 'Tighten appointment quality.',
      do_not_distract: ['New offer sprawl'],
      last_updated_at: '2026-06-06T09:45:00Z',
    },
    projects_sorted_by_rank: false,
    projects: [
      { name: 'Ranked Advisor Pipeline', rank: 1, status: 'active', owner: 'Sean', priority: 'P1', summary: 'Primary project', next_step: 'Improve reply quality', id: 'project-1' },
      { name: 'Delivery Capacity Guardrails', rank: 2, status: 'active', owner: 'Team', priority: 'P2', summary: 'Protect fulfillment quality', id: 'project-2' },
    ],
    tools_context: { command_center_bridge: 'read-only available' },
    metrics: { booked_calls: 12, cash_collected: '$42k', access_token: 'ghp_abcdefghijklmnopqrstuvwxyz123456' },
    sources: [{ title: 'Command Center Snapshot', updated_at: '2026-06-06T09:30:00Z', path: '/readonly/snapshot' }],
    business_context_docs: [
      { title: 'Elevated Advisor Operating Brief', updated_at: '2026-06-05', source: 'docs', excerpt: 'Sean runs lead generation for independent financial advisors.' },
    ],
    bridge_token: 'ghp_abcdefghijklmnopqrstuvwxyz123456',
    nested: { api_key: 'sk-abcdefghijklmnopqrstuvwxyz123456' },
  },
});

for (const value of [
  '--- LIVE COMMAND CENTER CONTEXT (read-only) ---',
  'generated_at: 2026-06-06T10:00:00Z',
  'scope: full-business',
  'sources:',
  'source_timestamps:',
  'current_priorities:',
  'top_priorities: ["Grow qualified appointments","Protect delivery capacity"]',
  'current_constraint: Show rate needs qualification improvements.',
  'weekly_focus: Tighten appointment quality.',
  'do_not_distract: ["New offer sprawl"]',
  'ranked_projects_from_command_center:',
  'rank: 1 | name: Ranked Advisor Pipeline | status: active',
  'rank: 2 | name: Delivery Capacity Guardrails | status: active',
  'instruction: If Sean asks for top projects',
  'projects_sorted_by_rank:',
  'top_projects:',
  'Advisor Pipeline',
  'active_operations:',
  'Outbound System',
  'blockers:',
  'Calendar Show Rate',
  'pending_decisions:',
  'Offer Packaging',
  'recent_dashboard_events:',
  'Dashboard Event',
  'recent_ideas:',
  'Build pre-call proof packet',
  'kpi_headlines:',
  'booked_calls: 12',
  'tools_context:',
  'command_center_bridge: read-only available',
  'access_token: [redacted]',
  'business_context_docs_excerpts:',
  'Elevated Advisor Operating Brief',
  'source: docs',
  'command_center_state.summary: Command Center is focused on acquisition and delivery capacity.',
]) {
  assert(full.includes(value), `full context should include ${value}`);
}
assert(!full.includes('ghp_abcdefghijklmnopqrstuvwxyz123456'));
assert(!full.includes('sk-abcdefghijklmnopqrstuvwxyz123456'));
assert(full.length <= 40000);

console.log('Chat mode assertions passed');
