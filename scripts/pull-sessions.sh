#!/bin/bash
# Pulls exported BMAD Voice sessions to iCloud for Claude Code to read
# Runs as part of the daily cron, or manually anytime

ICLOUD_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/ClaudeCode/bmad-voice-sessions"
API_URL="https://bmad-voice.vercel.app/api/export-session"

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

# Pull unpicked sessions and save as markdown files
python3 -c "
import json, os, urllib.request

url = '${API_URL}?secret=${SECRET}'
req = urllib.request.Request(url, headers={'x-session-token': '${SECRET}'})
try:
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
except Exception as e:
    print(f'Pull failed: {e}')
    exit(1)

sessions = data.get('sessions', [])
if not sessions:
    print('No new sessions to pull.')
    exit(0)

icloud = '$ICLOUD_DIR'
for s in sessions:
    date_str = (s.get('session_date') or s.get('created_at', ''))[:10]
    sid = s.get('id', 'unknown')
    filename = f'bmad-session-{date_str}-{sid}.md'
    filepath = os.path.join(icloud, filename)

    with open(filepath, 'w') as f:
        f.write(f'# BMAD Voice Session - {date_str}\n\n')
        f.write(f'Cost: \${ s.get(\"cost\", 0) }\n\n')
        f.write('## Summary\n\n')
        f.write(s.get('summary', 'No summary') + '\n')

    print(f'Saved: {filename}')

print(f'Pulled {len(sessions)} session(s).')
"
