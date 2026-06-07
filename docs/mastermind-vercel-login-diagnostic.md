# Mastermind Vercel Login Diagnostic

This report covers the old Vercel Mastermind app at `mastermind.seanthomas.com` and `bmad-voice.vercel.app`.

## Findings

- Protected browser calls use the same-origin Vercel API helper and attach `x-session-token`.
- Login stores the returned session token in `localStorage` as `bmad_token`.
- Reload and mobile lifecycle resume restore `bmad_token`, `bmad_role`, and `bmad_label` before polling pending chat jobs.
- `api/chat.js` fetches Command Center context server-side from `COMMAND_CENTER_CONTEXT_URL` with `MASTERMIND_BRIDGE_TOKEN`.
- `api/chat.js` and `api/ideas.js` use `MASTERMIND_BRIDGE_TOKEN` server-side for Ideas capture.
- The browser bundle does not reference Command Center bridge URLs or bridge/Hermes/Vercel/dashboard secret env names.
- Middleware protects `/api/chat`, `/api/chat-job`, `/api/ideas`, `/api/speak`, `/api/usage`, `/api/user-context`, and conversation endpoints with `x-session-token`.
- Middleware allows `/api/login`, `/api/context`, `/api/export-session` GET, and now `/api/health`.

The likely layer is Vercel app login/session/auth behavior or runtime app bridge behavior, not the Command Center VPS bridge itself.

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
