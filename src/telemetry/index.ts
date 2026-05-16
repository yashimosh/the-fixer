// telemetry — minimal event capture for The Fixer
//
// 5 events only. Answers the three questions that matter right now:
//   1. Did they click DRIVE?            → session_start
//   2. Which beats did they read?       → beat_read (with beat_id)
//   3. Where did they quit / finish?    → session_end (last_z, cargo_secured)
//   4. Which ending did they get?       → run_complete (variant)
//   5. Did they replay?                 → session_start again (run_count++)
//
// Infrastructure: Supabase REST API — one table, no SDK import.
// Table: fixer_events (id uuid default, session_id text, event text,
//                       payload jsonb, ts timestamptz default now())
//
// Configure via environment variables in .env.local (not committed):
//   VITE_SUPABASE_URL=https://your-project.supabase.co
//   VITE_SUPABASE_ANON_KEY=your-anon-key
//
// If not configured, track() is a no-op. No errors, no console spam.
// This lets the game run in dev without Supabase credentials.
//
// Privacy: no PII is captured. Session ID is a random UUID per page load,
// not linked to any user identity. GDPR-safe by design.

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL     as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const CONFIGURED        = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

// ── Session identity ─────────────────────────────────────────────────────────
// One UUID per page load — survives across the run but resets on page reload.
// Stored in sessionStorage so replay-via-reload creates a new session_id.
function getSessionId(): string {
  const key = 'fixer_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

// Run count — how many times this user has started a run in this browser.
// Persisted in localStorage so replay count survives page reloads.
function getRunCount(): number {
  return parseInt(localStorage.getItem('fixer_run_count') ?? '0', 10);
}
function incrementRunCount(): number {
  const n = getRunCount() + 1;
  localStorage.setItem('fixer_run_count', String(n));
  return n;
}

// ── Typed events ─────────────────────────────────────────────────────────────

export type FixerEvent =
  | { event: 'session_start'; run_count: number }
  | { event: 'beat_read';     beat_id: number; beat_text_snippet: string }
  | { event: 'cargo_lost';    speed_kmh: number; beat_id: number }
  | { event: 'run_complete';  variant: 'clean' | 'partial' | 'failed'; cargo_secured: number; duration_s: number }
  | { event: 'session_end';   last_z: number; cargo_secured: number; phase: string };

// ── Core track() function ────────────────────────────────────────────────────

let _queue: Array<{ session_id: string; event: string; payload: object }> = [];
let _flushScheduled = false;

export function track(data: FixerEvent): void {
  if (!CONFIGURED) return;

  const session_id = getSessionId();
  const { event, ...payload } = data;

  _queue.push({ session_id, event, payload });

  // Debounce flush — batch events that arrive within 2s of each other.
  // Reduces Supabase request count for rapid-fire sequences (beat + cargo_lost).
  if (!_flushScheduled) {
    _flushScheduled = true;
    setTimeout(flush, 2_000);
  }
}

async function flush(): Promise<void> {
  _flushScheduled = false;
  if (_queue.length === 0) return;

  const rows = _queue.splice(0, _queue.length); // drain queue atomically

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/fixer_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal', // no response body — faster
      },
      body: JSON.stringify(rows),
    });
  } catch {
    // Silently swallow — telemetry failure must never affect the game.
    // Failed events are dropped (not retried) to keep memory clean.
  }
}

// Flush on page unload — catches session_end events before the tab closes.
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});
window.addEventListener('pagehide', () => flush());

// ── Convenience wrappers ─────────────────────────────────────────────────────

/** Call when the player clicks DRIVE. */
export function trackSessionStart(): void {
  const run_count = incrementRunCount();
  track({ event: 'session_start', run_count });
}

/** Call when a story beat flashes. beat_id = index in incidents.beats array. */
export function trackBeatRead(beat_id: number, beat_text: string): void {
  track({
    event: 'beat_read',
    beat_id,
    beat_text_snippet: beat_text.slice(0, 40),
  });
}

/** Call when cargo is lost at a risk beat. */
export function trackCargoLost(beat_id: number, speed_kmh: number): void {
  track({ event: 'cargo_lost', beat_id, speed_kmh });
}

/** Call when the ending card appears. duration_s = run elapsed time in seconds. */
export function trackRunComplete(
  variant: 'clean' | 'partial' | 'failed',
  cargo_secured: number,
  duration_s: number,
): void {
  track({ event: 'run_complete', variant, cargo_secured, duration_s });
}

/** Call on page unload / beforeunload to capture where players quit mid-run. */
export function trackSessionEnd(last_z: number, cargo_secured: number, phase: string): void {
  track({ event: 'session_end', last_z, cargo_secured, phase });
}
