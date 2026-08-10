// Persist what this app already measures.
//
// bmad-voice was never blind to tokens — parseAnthropicCompletion has always
// pulled input/output counts out of the response and shown an estimated cost to
// the client. What it never did was WRITE any of it down, so the numbers lived
// for exactly one request and the app contributed nothing to the question
// "which app spent this month's API bill" (asked, and unanswerable, 2026-08-08).
//
// Same table shape and price table as the other apps, so the estate can be
// summed with one query.
//
// Writes are fire-and-forget: a missing usage row is an accounting gap, a
// failed voice reply is a broken app.
import { Pool } from '@neondatabase/serverless';

const PRICES = {
  'claude-opus-5': { in: 5, out: 25 },
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-5': { in: 3, out: 15 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-sonnet-4-20250514': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

const CACHE_WRITE = { '5m': 1.25, '1h': 2 };
const CACHE_READ = 0.1;

export function costUsd(model, totals, cacheTtl = '5m') {
  const p = PRICES[model];
  if (!p || !totals) return null;
  const perM = (n, rate) => ((n ?? 0) / 1e6) * rate;
  return (
    perM(totals.input, p.in) +
    perM(totals.output, p.out) +
    perM(totals.cacheWrite, p.in * (CACHE_WRITE[cacheTtl] ?? CACHE_WRITE['5m'])) +
    perM(totals.cacheRead, p.in * CACHE_READ)
  );
}

let ensured = false;

export async function logUsage({ route, model, inputTokens = 0, outputTokens = 0, cacheWrite = 0, cacheRead = 0, meta = null }) {
  if (!process.env.POSTGRES_URL) return;
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  try {
    if (!ensured) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_usage (
          id                 SERIAL PRIMARY KEY,
          ts                 TIMESTAMPTZ NOT NULL DEFAULT now(),
          app                TEXT NOT NULL,
          route              TEXT NOT NULL,
          model              TEXT NOT NULL,
          person             TEXT,
          input_tokens       INTEGER NOT NULL DEFAULT 0,
          output_tokens      INTEGER NOT NULL DEFAULT 0,
          cache_write_tokens INTEGER NOT NULL DEFAULT 0,
          cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
          calls              INTEGER NOT NULL DEFAULT 1,
          cost_usd           NUMERIC(10, 6),
          cache_ttl          TEXT NOT NULL DEFAULT '5m',
          meta               JSONB
        )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS ai_usage_ts ON ai_usage (ts DESC)`);
      ensured = true;
    }
    const totals = { input: inputTokens, output: outputTokens, cacheWrite, cacheRead, calls: 1 };
    await pool.query(
      `INSERT INTO ai_usage (app, route, model, input_tokens, output_tokens,
         cache_write_tokens, cache_read_tokens, calls, cost_usd, meta)
       VALUES ('bmad-voice', $1, $2, $3, $4, $5, $6, 1, $7, $8)`,
      [route, model, inputTokens, outputTokens, cacheWrite, cacheRead,
       costUsd(model, totals), meta ? JSON.stringify(meta) : null]
    );
  } catch (e) {
    console.error('ai_usage log failed:', e.message);
  } finally {
    await pool.end().catch(() => {});
  }
}

// Vercel freezes the instance the moment a handler returns, so a promise nobody
// awaited is simply discarded. Both writes in this app were started and never
// awaited on the reasoning that accounting must not delay a voice reply, which
// is a good instinct and, on this platform, produces no accounting at all: the
// two Node apps in the estate that did the same thing had empty ai_usage tables
// through weeks of real traffic (found 2026-08-10).
//
// So: still start the write early and never block the model call on it, but
// register the promise and await it once at the end of the handler. Latency
// cost is whatever is left of a single INSERT after the reply has been
// generated, which is usually nothing.
const pending = [];

export function trackPending(promise) {
  const p = Promise.resolve(promise).catch(e => console.error('background write failed:', e?.message));
  pending.push(p);
  return p;
}

export async function flushPending() {
  if (!pending.length) return;
  const inFlight = pending.splice(0, pending.length);
  await Promise.all(inFlight);
}
