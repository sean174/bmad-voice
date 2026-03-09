#!/bin/bash
# Syncs local Claude memory files to BMAD Voice admin context
# Run daily via cron: 0 6 * * * /Users/seanthomas/bmad-voice/scripts/sync-context.sh

ICLOUD_BASE="$HOME/Library/Mobile Documents/com~apple~CloudDocs/ClaudeCode"
MEMORY_DIR="$ICLOUD_BASE/memory"
CLAUDE_MD="$ICLOUD_BASE/CLAUDE.md"
API_URL="https://bmad-voice.vercel.app/api/context"

# Read the session secret from .env.local
SECRET=$(python3 -c "
for line in open('/Users/seanthomas/bmad-voice/.env.local'):
    if line.startswith('SESSION_SECRET='):
        val = line.strip().split('=',1)[1].strip('\"')
        print(val)
        break
")

if [ -z "$SECRET" ]; then
  echo "ERROR: No SESSION_SECRET found. Run 'npx vercel env pull .env.local' first."
  exit 1
fi

# Build context from memory files
CONTEXT=""

# Add top-of-mind priorities first (agents see this immediately)
if [ -f "$MEMORY_DIR/top-of-mind.md" ]; then
  CONTEXT+="$(cat "$MEMORY_DIR/top-of-mind.md")

"
fi

# Add key sections from CLAUDE.md (skip credentials and file paths)
if [ -f "$CLAUDE_MD" ]; then
  CONTEXT+="$(python3 -c "
import re
text = open('$CLAUDE_MD').read()
# Extract Who I Am section
m = re.search(r'## Who I Am\n(.*?)(?=\n## )', text, re.DOTALL)
if m: print('## Who I Am\n' + m.group(1))
# Extract 90-Day Goals section
m = re.search(r'## 90-Day Goals.*?\n(.*?)(?=\n## )', text, re.DOTALL)
if m: print('## 90-Day Goals\n' + m.group(1))
")

"
fi

# Add MEMORY.md
if [ -f "$MEMORY_DIR/MEMORY.md" ]; then
  CONTEXT+="## Current Memory
$(cat "$MEMORY_DIR/MEMORY.md")

"
fi

# Add projects.md if it exists
if [ -f "$MEMORY_DIR/projects.md" ]; then
  CONTEXT+="## Active Projects
$(cat "$MEMORY_DIR/projects.md")

"
fi

# Add lead-flow.md if it exists
if [ -f "$MEMORY_DIR/lead-flow.md" ]; then
  CONTEXT+="## Lead Flow
$(cat "$MEMORY_DIR/lead-flow.md")

"
fi

# Truncate if too long (keep under 8000 chars to not bloat the system prompt)
CONTEXT=$(echo "$CONTEXT" | head -c 8000)

# Post to API
ESCAPED=$(echo "$CONTEXT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')

RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-session-token: $SECRET" \
  -d "{\"context\": $ESCAPED, \"secret\": \"$SECRET\"}")

echo "$(date): Synced $(echo "$CONTEXT" | wc -c | tr -d ' ') chars. Response: $RESPONSE"
