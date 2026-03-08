#!/bin/bash
# Pulls brainstorm conversation logs to iCloud for Claude Code to read and integrate
# Run via cron alongside sync-context.sh

ICLOUD_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/ClaudeCode/bmad-voice-sessions"
API_URL="https://bmad-voice.vercel.app/api/conversation-log"
LAST_PULL_FILE="$HOME/.bmad-last-pull"

# Read the session secret from .env.local
SECRET=$(python3 -c "
for line in open('/Users/seanthomas/bmad-voice/.env.local'):
    if line.startswith('SESSION_SECRET='):
        val = line.strip().split('=',1)[1].strip('\"')
        print(val)
        break
")

if [ -z "$SECRET" ]; then
  echo "ERROR: No SESSION_SECRET found."
  exit 1
fi

mkdir -p "$ICLOUD_DIR"

# Get last pull timestamp, default to 24 hours ago
if [ -f "$LAST_PULL_FILE" ]; then
  LAST_PULL=$(cat "$LAST_PULL_FILE")
else
  LAST_PULL=$(python3 -c "from datetime import datetime, timedelta; print((datetime.utcnow() - timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M:%S'))")
fi

# Pull conversations since last pull
python3 -c "
import json, os, urllib.request
from datetime import datetime

url = '${API_URL}?secret=${SECRET}&date=${LAST_PULL}&user=sean'
req = urllib.request.Request(url)
req.add_header('x-session-token', '${SECRET}')
try:
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
except Exception as e:
    print(f'Pull failed: {e}')
    exit(1)

messages = data.get('messages', [])
if not messages:
    print('No new conversations to pull.')
    exit(0)

# Group by session_id
sessions = {}
for msg in messages:
    sid = msg.get('session_id', 'unknown')
    if sid not in sessions:
        sessions[sid] = []
    sessions[sid].append(msg)

icloud = '$ICLOUD_DIR'
today = datetime.now().strftime('%Y-%m-%d')
filename = f'brainstorm-conversations-{today}.md'
filepath = os.path.join(icloud, filename)

# Append to today's file (don't overwrite, there may be multiple pulls)
mode = 'a' if os.path.exists(filepath) else 'w'
with open(filepath, mode) as f:
    if mode == 'w':
        f.write(f'# Brainstorm Conversations - {today}\n\n')
        f.write('These are conversations from the Brainstorm app. Review and integrate key insights into memory.\n\n')

    for sid, msgs in sessions.items():
        time_str = msgs[0].get('created_at', '')[:19].replace('T', ' ')
        f.write(f'---\n\n## Session ({time_str})\n\n')
        for msg in msgs:
            f.write(f'**You:** {msg[\"user_message\"]}\n\n')
            f.write(f'**Team:** {msg[\"assistant_message\"]}\n\n')

print(f'Saved {len(messages)} message(s) across {len(sessions)} session(s) to {filename}')
"

# Update last pull timestamp
python3 -c "from datetime import datetime; print(datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))" > "$LAST_PULL_FILE"

echo "$(date): Pull complete."
