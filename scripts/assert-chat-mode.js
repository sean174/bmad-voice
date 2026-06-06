const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const chatPath = path.join(__dirname, '..', 'api', 'chat.js');
const source = fs.readFileSync(chatPath, 'utf8')
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
    kpi_headlines: { revenue: '$1' },
    blockers: [{ title: 'Blocked launch', blocked_on: 'approval' }],
    pending_decisions: [{ title: 'Choose offer', question: 'A or B?' }],
    active_operations: [{ title: 'Launch', status: 'active' }],
    newest_ideas: [{ text: 'Fast briefing' }],
    business_context_docs: [{ title: 'Should not be included', content: 'nope' }],
  },
});

assert(compact.includes('generated_at: 2026-06-05T00:00:00Z'));
assert(compact.includes('newest_ideas:'));
assert(!compact.includes('business_context_docs_excerpts'));
assert(compact.length <= 8000);

console.log('Chat mode assertions passed');
