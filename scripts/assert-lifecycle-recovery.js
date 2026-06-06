const assert = require('assert');
const fs = require('fs');
const path = require('path');

const index = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function assertIncludes(value) {
  assert(index.includes(value), `public/index.html should include ${value}`);
}

assertIncludes("document.addEventListener('visibilitychange'");
assertIncludes("window.addEventListener('pagehide', handleLifecycleBackground)");
assertIncludes("window.addEventListener('pageshow', handleLifecycleResume)");
assertIncludes("document.addEventListener('freeze', handleLifecycleBackground)");
assertIncludes("document.addEventListener('resume', handleLifecycleResume)");

assertIncludes('function stopSpeechRecognitionForLifecycle()');
assertIncludes('function resetStuckUiAfterLifecycle()');
assertIncludes('function restoreSessionFromStorage()');
assertIncludes('function handleLifecycleBackground()');
assertIncludes('function handleLifecycleResume()');

assertIncludes('suppressNextRecognitionSend');
assertIncludes('abortController.abort()');
assertIncludes('removeThinking()');
assertIncludes('stopAudio()');
assertIncludes("showToast('Session resumed. Ready when you are.', 'info')");

assert(
  index.includes('if (suppressNextRecognitionSend || lifecycleSuspended)'),
  'recognition.onend should not auto-send after lifecycle suspension'
);
assert(!index.includes('Session resumed. Ready when you are\u2014'), 'resume notice should not use an em dash');

console.log('Lifecycle recovery assertions passed');
