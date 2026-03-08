#!/bin/bash
# Syncs local Claude memory files to BMAD Voice admin context
# Run daily via cron: 0 6 * * * /Users/seanthomas/bmad-voice/scripts/sync-context.sh

MEMORY_DIR="/Users/seanthomas/.claude/projects/-Users-seanthomas/memory"
CLAUDE_MD="/Users/seanthomas/.claude/CLAUDE.md"
API_URL="https://bmad-voice.vercel.app/api/context"

# Read the session secret from Vercel env (pulled locally)
SECRET=$(grep SESSION_SECRET /Users/seanthomas/bmad-voice/.env.local 2>/dev/null | head -1 | cut -d= -f2-)

if [ -z "$SECRET" ]; then
  echo "ERROR: No SESSION_SECRET found. Run 'npx vercel env pull .env.local' first."
  exit 1
fi

# Build context from memory files
CONTEXT=""

# Add key sections from CLAUDE.md (skip credentials and file paths)
if [ -f "$CLAUDE_MD" ]; then
  CONTEXT+="## Who I Am
$(sed -n '/^## Who I Am/,/^## /p' "$CLAUDE_MD" | head -n -1)

"
  CONTEXT+="## 90-Day Goals
$(sed -n '/^## 90-Day Goals/,/^## /p' "$CLAUDE_MD" | head -n -1)

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
  -d "{\"context\": $ESCAPED, \"secret\": \"$SECRET\"}")

echo "$(date): Synced $(echo "$CONTEXT" | wc -c | tr -d ' ') chars. Response: $RESPONSE"
