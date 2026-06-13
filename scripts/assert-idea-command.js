const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const chatPath = path.join(__dirname, '..', 'api', 'chat.js');
const ideasPath = path.join(__dirname, '..', 'api', 'ideas.js');
const source = fs.readFileSync(chatPath, 'utf8')
  .replace(/^import\s+\{\s*Pool\s*\}\s+from\s+'@neondatabase\/serverless';\n/m, '')
  .replace(/^import\s+\{\s*saveIdeaPayloadToCommandCenter\s*\}\s+from\s+'\.\/ideas\.js';\n/m, '')
  .replace(/^export\s+async\s+function\s+generateChatCompletion/m, 'async function generateChatCompletion')
  .replace(/^export\s+default\s+async\s+function\s+handler/m, 'async function handler');
const rawChatSource = fs.readFileSync(chatPath, 'utf8');
const ideasSource = fs.readFileSync(ideasPath, 'utf8');

const context = {
  console,
  process: { env: {} },
  require,
  fetch: async () => {
    throw new Error('fetch should not be called by command assertions');
  },
  TextDecoder,
};

vm.runInNewContext(`${source}\nthis.getIdeaCommandText = getIdeaCommandText;`, context, {
  filename: chatPath,
});

const cases = [
  ['save this idea – lets triple our ROI', 'lets triple our ROI'],
  ['please save this idea lets quadruple our ROAS', 'lets quadruple our ROAS'],
  ['should I save this as an idea?', ''],
];

for (const [input, expected] of cases) {
  assert.strictEqual(context.getIdeaCommandText(input), expected, input);
}

assert(ideasSource.includes('export async function saveIdeaPayloadToCommandCenter'), 'api/ideas.js should export the shared durable idea save helper');
assert(rawChatSource.includes("import { saveIdeaPayloadToCommandCenter } from './ideas.js';"), 'chat idea command should reuse the same save helper as /api/ideas');
assert(rawChatSource.includes('return saveIdeaPayloadToCommandCenter({'), 'chat idea command should call the shared idea save helper');
assert(rawChatSource.includes("tags: ['phase-0']"), 'chat idea command should use the button-compatible idea tags');
assert(rawChatSource.includes("via: 'api-chat-intercept'"), 'chat idea command should identify chat-command idea saves in metadata');
assert(!rawChatSource.includes('I could not save that idea. Try the Save Idea button or retry in a moment.'), 'chat idea command should not emit the old generic failure copy');

console.log('Idea command assertions passed');
