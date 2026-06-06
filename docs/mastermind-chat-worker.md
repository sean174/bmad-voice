# Mastermind Chat Worker

`POST /api/chat-job` now queues a `mastermind_chat_jobs` row and returns quickly by default. A VPS process must run this worker so queued jobs continue after the browser or phone app closes.

## Direct VPS Command

From the deployed repo directory:

```bash
POSTGRES_URL='postgres://...' ANTHROPIC_API_KEY='...' node scripts/mastermind-chat-worker.mjs
```

Include the same Mastermind environment variables used by the web app, especially any Hermes, Command Center context, Ideas, auth, and rate-limit settings required for normal chat behavior. Do not print those values in logs.

Optional worker tuning:

```bash
MASTERMIND_CHAT_WORKER_POLL_MS=2500
MASTERMIND_CHAT_JOB_STALE_SECONDS=900
```

## systemd Example

Create this on the VPS as `/etc/systemd/system/mastermind-chat-worker.service` after deployment:

```ini
[Unit]
Description=Mastermind chat background worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/path/to/bmad-voice
EnvironmentFile=/path/to/bmad-voice/.env
ExecStart=/usr/bin/node scripts/mastermind-chat-worker.mjs
Restart=always
RestartSec=5
User=mastermind
Group=mastermind

[Install]
WantedBy=multi-user.target
```

Then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mastermind-chat-worker
sudo systemctl status mastermind-chat-worker
```

## Behavior

- The API owns job creation and polling.
- The worker owns job execution.
- The worker claims `queued` jobs atomically with row locks.
- A `running` job whose `updated_at` is older than `MASTERMIND_CHAT_JOB_STALE_SECONDS` can be claimed again after a worker crash or restart.
- Chat jobs store request payload, status, and result fields only. Business-system writes remain disabled except the existing Ideas capture path in `api/chat.js`.
