const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const chatJob = fs.readFileSync(path.join(root, 'api', 'chat-job.js'), 'utf8');
const chatJobs = fs.readFileSync(path.join(root, 'api', 'mastermind-chat-jobs.js'), 'utf8');
const chat = fs.readFileSync(path.join(root, 'api', 'chat.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const voice = fs.readFileSync(path.join(root, 'public', 'voice.html'), 'utf8');
const legacyVoice = fs.readFileSync(path.join(root, 'public', 'voice-legacy.html'), 'utf8');
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

for (const value of [
  'background_continuation: true',
  'background_continuation: false',
  'MASTERMIND_CHAT_JOB_INLINE',
  'Queued for the Mastermind VPS worker',
]) {
  assert(chatJob.includes(value), `api/chat-job.js should include ${value}`);
}

for (const value of [
  'mastermind_chat_jobs',
  'queued',
  'running',
  'completed',
  'failed',
  'assistant_message',
]) {
  assert(chatJobs.includes(value), `api/mastermind-chat-jobs.js should include ${value}`);
}

for (const value of [
  'generateChatCompletion',
  'buildChatCompletionRequestForJob',
  'FOR UPDATE SKIP LOCKED',
  "status = 'queued'",
  "status = 'running' AND updated_at < NOW()",
  'runClaimedJob',
  'markJobCompleted',
  'markJobFailed',
]) {
  assert(chatJobs.includes(value), `api/mastermind-chat-jobs.js should include ${value}`);
}

assert(chat.includes('export async function generateChatCompletion'), 'api/chat.js should export generateChatCompletion');
assert(chat.includes('Ideas capture is the only allowed write path.'), 'chat safety boundary should remain');
assert(chat.includes('Do not mutate Command Center projects, operations, decisions, delegations, or instructions.'), 'Hermes safety boundary should remain');
assert(chat.includes('TOP_COMMAND_CENTER_PROJECTS'), 'Command Center top projects context should remain');

for (const value of [
  "const PENDING_CHAT_JOB_KEY = 'mastermind_pending_chat_job'",
  'function ensureSessionId()',
  'function savePendingChatJob(job)',
  'function pollPendingChatJob()',
  "apiFetch('/api/chat-job'",
  "apiFetch(`/api/chat-job?job_id=${encodeURIComponent(pending.job_id)}`)",
  'localStorage.setItem(PENDING_CHAT_JOB_KEY',
  'Mastermind is still working. You can leave and come back.',
  "window.addEventListener('pageshow', handleLifecycleResume)",
  "document.addEventListener('resume', handleLifecycleResume)",
  'setTimeout(pollPendingChatJob, 500)',
]) {
  assert(index.includes(value), `public/index.html should include ${value}`);
}

const asyncJobFunction = index.slice(index.indexOf('async function _submitAsyncChatJob()'), index.indexOf('async function _streamResponse()'));
assert(asyncJobFunction.includes("body: JSON.stringify({"), 'async job function should post JSON');
assert(!asyncJobFunction.includes('abortController'), 'async chat job should not be tied to the browser abort controller');
assert(!asyncJobFunction.includes('signal:'), 'async chat job should not abort as if the browser stream were the work');

const visibleSurface = [index, fs.readFileSync(path.join(root, 'public', 'manifest.json'), 'utf8')].join('\n');
assert(!/CEO Coach|Coach Mode/.test(visibleSurface), 'visible UI should not be rebranded to CEO Coach or Coach Mode');

for (const value of [
  'id="written-mode-btn"',
  'Written Mode',
  'id="voice-mode-btn"',
  'Voice Mode',
  'id="save-idea-btn"',
  '>Save Idea<',
  'id="idea-confirm-overlay"',
  'id="idea-confirm-input"',
  'id="idea-confirm-save-btn"',
]) {
  assert(index.includes(value), `public/index.html should include ${value}`);
}

const header = index.slice(index.indexOf('<div id="header">'), index.indexOf('<!-- End session overlay -->'));
assert(header.includes('id="save-idea-btn"'), 'Save Idea button should be in the top header');

const saveIdeaClick = index.slice(
  index.indexOf("saveIdeaBtn.addEventListener('click'"),
  index.indexOf("ideaCancelBtn.addEventListener('click'")
);
assert(saveIdeaClick.includes('openIdeaConfirm(getIdeaDraftForConfirmation())'), 'Save Idea should open confirm/edit flow');
assert(!saveIdeaClick.includes('saveIdeaText('), 'Save Idea button should not save without explicit confirm');

const ideaDraftFunction = index.slice(
  index.indexOf('function getIdeaDraftForConfirmation()'),
  index.indexOf('function openIdeaConfirm')
);
assert(ideaDraftFunction.includes('const typedDraft = messageInput.value.trim()'), 'Save Idea should inspect current typed draft first');
assert(ideaDraftFunction.includes('if (typedDraft) return typedDraft'), 'Save Idea should prefer non-empty typed draft');
assert(ideaDraftFunction.includes('return getLatestUserMessageText()'), 'Save Idea should fall back to latest user message');
assert(index.includes("openIdeaConfirm(initialText = '')"), 'Save Idea confirm flow should support blank input');

const saveIdeaTextFunction = index.slice(
  index.indexOf('async function saveIdeaText(text)'),
  index.indexOf('function logConversationExchange')
);
assert(saveIdeaTextFunction.includes("apiFetch('/api/ideas'"), 'Save Idea helper should call existing ideas API');
assert(saveIdeaTextFunction.includes('session_id: ensureSessionId()'), 'Save Idea payload should include an initialized session_id');
assert(!saveIdeaTextFunction.includes('session_id: sessionId'), 'Save Idea payload should not send the nullable sessionId variable');

const confirmIdeaClick = index.slice(
  index.indexOf("ideaConfirmSaveBtn.addEventListener('click'"),
  index.indexOf('// ---- SEND MESSAGE ----')
);
assert(confirmIdeaClick.includes('await saveIdeaText(text)'), 'Confirm button should save through existing ideas API');
assert(confirmIdeaClick.includes("setIdeaStatus('IDEA BANKED')"), 'Successful bridge save should show IDEA BANKED feedback');
assert(index.includes("apiFetch('/api/ideas'"), 'Idea saving should use existing Mastermind ideas API bridge');
assert(confirmIdeaClick.includes("showToast(e.message || 'Could not save idea.', 'error')"), 'Failed save should show a readable error');
const confirmIdeaCatch = confirmIdeaClick.slice(confirmIdeaClick.indexOf('} catch (e) {'), confirmIdeaClick.indexOf('} finally {'));
assert(!confirmIdeaCatch.includes('closeIdeaConfirm()'), 'Failed save should preserve the editable idea sheet');

const voiceRedirect = (vercelConfig.redirects || []).find((redirect) => redirect.source === '/voice.html');
assert(voiceRedirect, 'vercel config should redirect /voice.html before the legacy document can render');
assert.strictEqual(voiceRedirect.destination, '/?mastermind=1&chat=1&v=2026-06-13-2', '/voice.html should route into the current root UI at the edge');
assert(!voice.includes('window.location.replace'), 'default /voice.html should not depend on a client-side redirect script');
assert(!voice.includes('id="orb"'), 'default /voice.html should not contain the 8-bit app');
assert(voice.includes('/?mastermind=1&chat=1&v=2026-06-13-2'), 'static /voice.html fallback should still point at the current Mastermind chat UI');
assert(legacyVoice.includes('id="chat-link"'), '8-bit Chat link should be script-addressable');
assert(legacyVoice.includes("window.location.pathname === '/voice-legacy.html'"), 'explicit legacy voice route should render the 8-bit app');
assert(legacyVoice.includes("params.get('legacy_voice') === '1'"), 'legacy 8-bit voice query opt-in should remain supported');
assert(legacyVoice.includes('href="/?mastermind=1&chat=1&v='), '8-bit Chat link should target the current Mastermind chat interface with cache busting');
assert(legacyVoice.includes("sessionStorage.setItem('prefer_chat', '1')"), '8-bit Chat click should pin chat before navigating');
assert(legacyVoice.includes("url.searchParams.set('mastermind', '1')"), '8-bit Chat click should keep the current Mastermind route');
assert(legacyVoice.includes("url.searchParams.set('chat', '1')"), '8-bit Chat click should preserve legacy chat route compatibility');
assert(legacyVoice.includes("url.searchParams.set('t', Date.now().toString(36))"), '8-bit Chat click should include a navigation cache buster');
assert(index.includes("__routeParams.get('mastermind') === '1'"), 'current Mastermind route should pin chat on mobile');
assert(index.includes("__routeParams.get('chat') === '1'"), 'legacy chat route should remain accepted for compatibility');
assert(index.includes('id="save-idea-btn"'), 'live chat source should include the visible Save Idea button');
assert(index.includes('id="voice-mode-btn"'), 'live chat source should include the visible Voice Mode button');
assert(!index.includes("window.location.replace('/voice.html')"), 'index should not auto-redirect authenticated mobile users to the legacy voice page');
assert(!index.includes('href="/voice.html"'), 'default entry links should not send users to the legacy voice page');

import(pathToFileURL(path.join(root, 'api', 'mastermind-chat-jobs.js')).href)
  .then(({ buildChatCompletionRequestForJob }) => {
    const messages = [{ role: 'user', content: 'What live Command Center context do you have?' }];
    const repairedMissingLabel = buildChatCompletionRequestForJob({
      job_id: 'job-lowercase-sean',
      session_id: 'session-live-context',
      user_label: 'sean',
      request: { mode: 'deep' },
      messages,
    });

    assert.strictEqual(repairedMissingLabel.user_label, 'sean');
    assert.strictEqual(repairedMissingLabel.session_id, 'session-live-context');
    assert.deepStrictEqual(repairedMissingLabel.messages, messages);

    const repairedUnknownLabel = buildChatCompletionRequestForJob({
      job_id: 'job-unknown-request-label',
      session_id: 'session-live-context',
      user_label: 'sean',
      request: { mode: 'fast', user_label: 'unknown', messages: [] },
      messages,
    });

    assert.strictEqual(repairedUnknownLabel.user_label, 'sean');
    assert.deepStrictEqual(repairedUnknownLabel.messages, messages);

    const preservesExplicitRequestLabel = buildChatCompletionRequestForJob({
      job_id: 'job-explicit-label',
      session_id: 'session-live-context',
      user_label: 'Sean',
      request: { mode: 'fast', user_label: ' SEAN ', messages },
      messages: [],
    });

    assert.strictEqual(preservesExplicitRequestLabel.user_label, 'SEAN');
    assert.deepStrictEqual(preservesExplicitRequestLabel.messages, messages);

    console.log('Chat job assertions passed');
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
