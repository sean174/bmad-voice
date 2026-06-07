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
    "current_priorities": {
      "top_priorities": [
        "90-day pipeline goal"
      ],
      "current_constraint": "Current constraint used to judge tradeoffs.",
      "weekly_focus": "Primary focus for the current week.",
      "do_not_distract": [
        "Lower-priority work to avoid"
      ],
      "last_context_refresh": "2026-06-06T09:45:00Z",
      "last_updated_at": "2026-06-06T09:45:00Z"
    },
    "projects_sorted_by_rank": false,
    "projects": [
      {
        "name": "Advisor Pipeline",
        "rank": 1,
        "status": "active",
        "owner": "Sean",
        "priority": "P1",
        "summary": "Highest leverage project by Command Center rank."
      }
    ],
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
    "recent_dashboard_events": [
      {
        "name": "Pipeline status changed",
        "summary": "Recent read-only dashboard signal.",
        "created_at": "2026-06-06T09:45:00Z"
      }
    ],
    "tools_context": {
      "asana": "read-only summary",
      "ghl": "read-only summary"
    },
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

Mastermind also accepts common aliases such as `generatedAt`, `context_scope`, `source_list`, `metrics`, `priority_projects`, `current_projects`, `ranked_projects`, `operations`, `ops`, `risks`, `stuck_items`, `open_decisions`, `newest_ideas`, `dashboard_events`, `events`, `tools`, `context_docs`, `documents`, and nested `command_center_state`.

## Formatter Notes

The live Command Center bridge may send `projects_sorted_by_rank` as a boolean availability flag while the ranked rows are under `projects`. Mastermind formats those rows into `ranked_projects_from_command_center`, sorted by ascending `rank`, with rank, name or title, status, owner, priority, summary, next step, and id for the top eight projects. This section is the model's primary source for questions like "What are my three top projects?"

The live bridge may send `current_priorities` as an object rather than an array. Mastermind formats `top_priorities`, `current_constraint`, `weekly_focus`, and `do_not_distract`, plus refresh timestamps when present, in both compact and full context.

Root cause fixed on 2026-06-07: the compact formatter previously called the list formatter for object-shaped `current_priorities`, so no priority details were printed. It also looked for ranked project rows in `projects_sorted_by_rank` before `projects`; when `projects_sorted_by_rank` was the boolean `false`, the explicit ranked-project section was empty and the model hedged even though the bridge had ranked rows under `projects`.

Second root cause fixed on 2026-06-07: admin context injection was still gated by a case-sensitive `AUTH_PASSWORDS` label comparison. Live chat jobs sent `user_label` as lowercase `sean`, while the configured auth entry could store `Sean` or another case variant. That mismatch made the chat API treat Sean as non-admin, so the protected Command Center context was skipped even after the formatter was corrected. Admin label matching is now whitespace-normalized and case-insensitive only for the authorization check; stored labels remain unchanged elsewhere.

## Fallback Behavior

- If either environment variable is missing, Mastermind skips live Command Center context.
- If the endpoint fails, returns non-JSON, or returns a non-2xx response, Mastermind skips live Command Center context and continues without inventing business state.
- Fast voice mode uses a compact read-only snapshot: sources, source timestamps, KPI headlines, current priorities, `ranked_projects_from_command_center`, ranked/top projects, blockers, pending decisions, active operations, recent operations, recent dashboard events, newest ideas, tools context, and concise business document excerpts.
- Deep and operator modes use the fuller read-only snapshot, plus admin context, recent conversations, and matched reference documents when available.
- Secret-like keys and values are redacted before context is formatted.
- When live context is present, Mastermind should summarize what is visible from the snapshot instead of saying it lacks the full operational picture. It should name missing sources only when the snapshot itself indicates they are missing.

Do not include raw credentials, private tokens, API keys, cookies, or write-capable URLs in the snapshot. Source labels should identify where the state came from without exposing secrets.
