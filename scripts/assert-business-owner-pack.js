const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludesAll(text, values, label) {
  for (const value of values) {
    assert(
      text.includes(value),
      `${label} should include ${value}`
    );
  }
}

const chat = read('api/chat.js');
const manifest = JSON.parse(read('public/manifest.json'));
const index = read('public/index.html');

assert.strictEqual(manifest.name, 'Mastermind');
assert.strictEqual(manifest.short_name, 'Mastermind');
assert(index.includes('<title>Mastermind</title>'));
assert(index.includes('id="header-title">Mastermind</div>'));

const visibleSurface = [read('public/index.html'), read('public/manifest.json')].join('\n');
assert(!/CEO Coach|Coach Mode/.test(visibleSurface), 'visible UI should not be rebranded to CEO Coach or Coach Mode');

assertIncludesAll(chat, [
  'Mastermind Business Owner Pack',
  'mastermind/business-owner-pack',
  'strategy-filter',
  'roadblock-unblocker',
  'delegation-offloading-operator',
  'highest-leverage-activity',
  'weekly-ceo-review',
  'decision-draft',
  'delegation-handoff-draft',
], 'chat prompt');

assertIncludesAll(chat, [
  'Ideas capture is the only allowed write path.',
  'You cannot create tasks, update Asana, update Command Center projects',
  'write to GHL/SMS/Slack/Vercel/Google/business systems',
  'Do not mutate Command Center projects, operations, decisions, delegations, or instructions.',
  'Decision and delegation handoffs are draft text only.',
  'Do not execute business-system changes, deployments, commits, pushes, GHL/SMS/Slack/Google/Asana/Vercel actions',
], 'safety prompt');

const packFiles = [
  'mastermind/business-owner-pack/README.md',
  'mastermind/business-owner-pack/agents/mastermind-facilitator.md',
  'mastermind/business-owner-pack/tasks/strategy-filter.md',
  'mastermind/business-owner-pack/tasks/roadblock-unblocker.md',
  'mastermind/business-owner-pack/tasks/delegation-offloading-operator.md',
  'mastermind/business-owner-pack/checklists/highest-leverage-activity.md',
  'mastermind/business-owner-pack/workflows/weekly-ceo-review.yaml',
  'mastermind/business-owner-pack/templates/decision-draft.md',
  'mastermind/business-owner-pack/templates/delegation-handoff-draft.md',
];

for (const file of packFiles) {
  const content = read(file);
  assert(content.trim().length > 0, `${file} should not be empty`);
  assert(!content.includes('\u2014'), `${file} should not contain em dashes`);
}

assert(!chat.includes('\u2014'), 'api/chat.js should not contain em dashes in prompt copy');

const readOnlyPackText = packFiles.map(read).join('\n');
assertIncludesAll(readOnlyPackText, [
  'draft-only',
  'Ideas capture is the only write path',
  'Do not update Command Center, Asana, GHL, Slack, Google, Vercel, SMS, or any business system.',
], 'business owner pack guardrails');

console.log('Business owner pack assertions passed');
