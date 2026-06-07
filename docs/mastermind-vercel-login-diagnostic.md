# Mastermind Vercel Login Diagnostic

This report covers the old Vercel Mastermind app at `mastermind.seanthomas.com` and `bmad-voice.vercel.app`.

## Findings

- Protected browser calls use the same-origin Vercel API helper and attach `x-session-token`.
- Login stores the returned session token in `localStorage` as `bmad_token`.
- Reload and mobile lifecycle resume restore `bmad_token`, `bmad_role`, and `bmad_label` before polling pending chat jobs.
- A stale `bmad_token` can make the app look logged in while every protected call fails with 401. The current browser code now validates saved sessions with a protected same-origin `/api/chat-job` probe and clears only Mastermind session keys when a protected response returns 401.
- The start screen now shows a non-secret health/session diagnostic. It only reports reachability/configuration booleans and never prints tokens, URLs, database strings, or bridge data.
- The login and start screens show a visible build stamp. Current expected build: `2026-06-07-2`.
- `https://mastermind.seanthomas.com/?reset=1` is a public browser/PWA recovery URL. It clears `localStorage` and `sessionStorage`, then redirects to `/` with cache-busting query parameters so iOS Safari or an installed PWA has to request the current app shell.
- Vercel sends `Cache-Control: no-store, max-age=0` for `/`, `/index.html`, and `/manifest.json`. Icons and other static assets remain cacheable.
- `api/chat.js` fetches Command Center context server-side from `COMMAND_CENTER_CONTEXT_URL` with `MASTERMIND_BRIDGE_TOKEN`.
- Fast mode also uses that protected server-side bridge. Its prompt receives a compact live snapshot with current priorities, ranked/top projects, active operations, blockers, pending decisions, KPI headlines, recent dashboard events, tools context, newest ideas, and concise business doc excerpts.
- `api/chat.js` and `api/ideas.js` use `MASTERMIND_BRIDGE_TOKEN` server-side for Ideas capture.
- The browser bundle does not reference Command Center bridge URLs or bridge/Hermes/Vercel/dashboard secret env names.
- Middleware protects `/api/chat`, `/api/chat-job`, `/api/ideas`, `/api/speak`, `/api/usage`, `/api/user-context`, and conversation endpoints with `x-session-token`.
- Middleware allows `/api/login`, `/api/context`, `/api/export-session` GET, and now `/api/health`.
- `/api/context` GET is public and returns the legacy `admin_context` table. It is not the same source as the protected Command Center context bridge used by `/api/chat`, so it can be empty, stale, or misleading even when chat has live Command Center context.

The likely layer is Vercel app login/session/auth behavior, chat job/runtime configuration, or runtime bridge behavior, not public app reachability.

## Ranked Root Cause Candidates

1. **Stale browser token after a production secret change.** The old frontend trusted any `localStorage.bmad_token` and skipped login. If `SESSION_SECRET` rotated or changed between deployments/domains, the user would land on the start screen but `/api/chat-job`, `/api/chat`, `/api/ideas`, `/api/speak`, `/api/usage`, `/api/user-context`, and conversation logging would all return 401. In the browser this appears as generic `Unauthorized` toasts, a stuck or cleared thinking state, failed idea saves, or failed audio/summarization paths.
2. **Stale mobile/PWA app shell after deployment.** The live HTML can be current while an iPhone installed PWA or Safari tab keeps running an older in-memory or cached shell. Symptoms include seeing old button behavior, no build stamp, or stale session recovery that only reloads the cached page. Use the reset URL below.
3. **Login succeeds but chat job/runtime config is missing or broken.** `/api/health` can return 200 while one of its `checks` booleans is false. If `POSTGRES_URL` is absent, `/api/chat-job` returns `400 No database configured` after auth. If Hermes/Anthropic or bridge runtime config is bad, chat jobs can fail later with `Failed to process chat job`, `AI service error`, or a queued job that never completes.
4. **Queued background worker is not processing jobs.** `/api/chat-job` POST normally returns 202 when `MASTERMIND_CHAT_JOB_INLINE` is not `true`. If the VPS worker is down or not pointed at the same database, the browser keeps polling and displays "Mastermind is still working. You can leave and come back." This can look like the app is hung even though auth is correct.
5. **Public `/api/context` is stale or misleading.** A user or operator checking `/api/context` may see old database-backed context and conclude Command Center context is wrong. Chat does not rely on that public route for live bridge context; admin chat fetches Command Center context server-side through the protected bridge envs.
6. **Login contract mismatch or malformed configured invite entries.** The frontend expects `/api/login` to return JSON with `token`, optional `role`, and optional `label`. The API does that for configured `AUTH_PASSWORDS` entries. If entries are malformed or missing, login returns 401/400 and the login screen reports `Wrong password`, `Password required`, or a connection error.

## Browser Console/Network Symptoms

- `GET /api/health` returns 200 but the app still fails: health only confirms public app reachability and env presence booleans, not that the saved browser token is current or that the chat worker completed a job.
- `POST /api/login` returns 200 with a token: login is working. Do not print the token. The next protected probe should be `/api/chat-job?job_id=session-check-probe`; 401 means the browser is using a stale or mismatched token.
- Protected calls return 401: before the fix, the app stayed on the start/chat screen and showed generic errors. After the fix, a 401 clears `bmad_token`, `bmad_role`, `bmad_label`, pending chat job state, and sends the user back to login with "Session expired. Sign in again."
- `/api/chat-job` POST returns 202 and later polls stay `queued` or `running`: auth is probably valid, but the background worker is not completing the job.
- `/api/chat-job` POST returns 400 after login: the request body or database configuration is bad. A simple authenticated GET without `job_id` should return 400 `job_id required`; a missing database returns 400 `No database configured`.
- `/api/chat-job?job_id=session-check-probe` returns 400 or 404 after login: the token passed middleware and the browser should show `Session accepted. Build 2026-06-07-2.` This probe is not expected to return a real chat job.
- `/api/chat` or completed chat jobs fail with 502/500-class errors: auth passed, but the model service, Hermes config, Anthropic fallback, or server-side bridge/runtime path failed.
- `/api/context` returns old or unexpected text: that route is legacy public database context, not proof of what the server-side Command Center bridge supplied to chat.
- A fast-mode reply that says it can see only basic Command Center context is a prompt/runtime regression, not proof that the bridge is missing. The chat runtime should now tell Mastermind to summarize visible live context whenever the protected snapshot is present and to call out missing sources only when the payload says they are missing.

## iPhone Reset Instructions

Use these steps when Safari or the installed Home Screen PWA still appears broken after deployment:

1. Open this exact URL on the phone: `https://mastermind.seanthomas.com/?reset=1`
2. Wait for it to redirect to `https://mastermind.seanthomas.com/?v=2026-06-07-2&t=...`.
3. Confirm the login or start screen shows `Build 2026-06-07-2`.
4. Sign in again with the invite code. Do not paste or screenshot the returned token.
5. If using the Home Screen PWA and it still shows an older build, fully close the PWA from the app switcher, open the reset URL in Safari once, then reopen the PWA. If the Home Screen icon still launches stale UI after that, remove and re-add the Home Screen app after confirming Safari shows `Build 2026-06-07-2`.

The in-app `Reset App Session` and `Switch User` controls perform the same storage clear and cache-busted reload. Use the direct reset URL when the app UI is too stale or stuck to trust the buttons.

## Safe Health Probe

`GET /api/health` is public and returns only booleans. It does not print URLs, tokens, API keys, database strings, or secret values.

Use it to separate basic Vercel app reachability and env presence from session-token failures:

```bash
curl -fsS https://bmad-voice.vercel.app/api/health
curl -fsS https://mastermind.seanthomas.com/api/health
```

Expected result: `ok` is true. Any `checks` value that is false points to a missing runtime env binding, without exposing the value.

## Non-secret Hermes Probes

Run these without printing secret values:

```bash
vercel env ls production
```

Confirm by name only that these production variables exist:

- `SESSION_SECRET`
- `AUTH_PASSWORDS`
- `POSTGRES_URL`
- `COMMAND_CENTER_CONTEXT_URL`
- `COMMAND_CENTER_IDEAS_URL`
- `MASTERMIND_BRIDGE_TOKEN`
- `HERMES_API_BASE_URL`
- `HERMES_API_KEY`

Login probe without printing the token:

```bash
TOKEN="$(curl -fsS https://bmad-voice.vercel.app/api/login \
  -H 'Content-Type: application/json' \
  --data '{"password":"REDACTED_INVITE_CODE"}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s); if(!j.token) process.exit(1); console.log(j.token)})")"
test -n "$TOKEN" && echo "login returned a session token"
```

Protected auth probe without printing the token:

```bash
curl -fsS https://bmad-voice.vercel.app/api/chat-job \
  -H "x-session-token: $TOKEN" \
  -o /tmp/mastermind-chat-job-probe.json \
  -w "status=%{http_code}\n"
```

Expected result: HTTP 400 with `job_id required`. A 401 means the session token used by the browser is not matching middleware.

Command Center context behavior probe through chat:

```bash
curl -fsS https://bmad-voice.vercel.app/api/chat \
  -H 'Content-Type: application/json' \
  -H "x-session-token: $TOKEN" \
  --data '{"messages":[{"role":"user","content":"Deep mode: what Command Center context do you have right now? Summarize sources and timestamps only."}],"user_label":"sean","mode":"deep"}' \
  -o /tmp/mastermind-chat-probe.sse \
  -w "status=%{http_code}\n"
```

Expected result: HTTP 200 SSE. The response should mention Command Center source/timestamp signals if context is available. Do not paste tokens or env values into logs.
