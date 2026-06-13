const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const chatJob = fs.readFileSync(path.join(root, 'api', 'chat-job.js'), 'utf8');
const chatJobs = fs.readFileSync(path.join(root, 'api', 'mastermind-chat-jobs.js'), 'utf8');
const chat = fs.readFileSync(path.join(root, 'api', 'chat.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

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
