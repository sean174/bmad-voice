# Command Center Context Contract

Mastermind can read a live Command Center snapshot when both environment variables are set:

- `COMMAND_CENTER_CONTEXT_URL`
- `MASTERMIND_BRIDGE_TOKEN`

The chat API sends a read-only `GET` request with `Authorization: Bearer <token>` and `Accept: application/json`. It does not write back to Command Center from this path. The only write path that remains enabled is existing Ideas capture.

## Expected JSON Shape

The endpoint should return JSON directly or wrapped in a top-level `data` object.

```json
{
  "data": {
    "generated_at": "2026-06-06T10:00:00Z",
    "scope": "full-business",
    "sources": [
      {
        "name": "Projects",
        "type": "command-center",
        "updated_at": "2026-06-06T09:30:00Z",
        "path": "read-only source label"
      }
    ],
    "source_timestamps": {
      "projects": "2026-06-06T09:30:00Z",
      "operations": "2026-06-06T09:20:00Z",
      "ideas": "2026-06-06T09:10:00Z"
    },
    "kpi_headlines": {
      "booked_calls": 12,
      "cash_collected": "$42k",
      "delivery_capacity": "healthy"
    },
    "top_projects": [
      {
        "name": "Advisor Pipeline",
        "priority": "P1",
        "status": "active",
        "owner": "Sean",
        "summary": "Current highest leverage growth project",
        "next_step": "Review reply quality"
      }
    ],
    "active_operations": [
      {
        "name": "Outbound System",
        "status": "running",
        "owner": "Team",
        "summary": "Daily prospecting and follow-up operation",
        "next_step": "Tighten appointment quality"
      }
    ],
    "blockers": [
      {
        "name": "Calendar Show Rate",
        "owner": "Sean",
        "blocked_on": "appointment quality",
        "summary": "Needs decision on pre-call qualification"
      }
    ],
    "pending_decisions": [
      {
        "name": "Offer Packaging",
        "owner": "Sean",
        "question": "Keep premium tier?",
        "deadline": "2026-06-10"
      }
    ],
    "recent_ideas": [
      {
        "text": "Build pre-call proof packet",
        "source": "Mastermind",
        "created_at": "2026-06-06T08:55:00Z"
      }
    ],
    "business_context_docs": [
      {
        "title": "Elevated Advisor Operating Brief",
        "updated_at": "2026-06-05",
        "source": "docs",
        "excerpt": "Short, non-secret summary for grounding responses."
      }
    ],
    "command_center_summary": "Short high-level state summary."
  }
}
```

Mastermind also accepts common aliases such as `generatedAt`, `context_scope`, `source_list`, `metrics`, `priority_projects`, `current_projects`, `operations`, `ops`, `risks`, `stuck_items`, `open_decisions`, `newest_ideas`, `context_docs`, `documents`, and nested `command_center_state`.

## Fallback Behavior

- If either environment variable is missing, Mastermind skips live Command Center context.
- If the endpoint fails, returns non-JSON, or returns a non-2xx response, Mastermind skips live Command Center context and continues without inventing business state.
- Fast voice mode uses a compact read-only snapshot: sources, source timestamps, KPI headlines, top projects, blockers, pending decisions, active operations, recent operations, and newest ideas.
- Deep and operator modes use the fuller read-only snapshot, plus admin context, recent conversations, and matched reference documents when available.
- Secret-like keys and values are redacted before context is formatted.

Do not include raw credentials, private tokens, API keys, cookies, or write-capable URLs in the snapshot. Source labels should identify where the state came from without exposing secrets.
