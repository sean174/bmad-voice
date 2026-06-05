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

console.log('Idea command assertions passed');
