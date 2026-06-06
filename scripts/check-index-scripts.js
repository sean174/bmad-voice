const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const index = fs.readFileSync(indexPath, 'utf8');
const scripts = [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1].trim())
  .filter(Boolean);

assert(scripts.length > 0, 'public/index.html should include inline script blocks');

scripts.forEach((script, index) => {
  new vm.Script(script, {
    filename: `public/index.html inline script ${index + 1}`,
  });
});

console.log('Index script syntax check passed');
