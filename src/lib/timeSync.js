// ─────────────────────────────────────────────────────────────────────────
// Server-time sync.
// The competition gate (boards open/close) must not depend on each student's
// device clock — a phone with the wrong time would lock its owner out or let
// them play past the close. We estimate the true time once from the HTTP
// `Date` header of our own origin (CDN/server clock) and expose serverNow().
// If the fetch fails we fall back to the device clock.
// ─────────────────────────────────────────────────────────────────────────

let offsetMs = 0;

export async function syncServerTime() {
  try {
    const t0 = Date.now();
    const res = await fetch(`${window.location.origin}/?t=${t0}`, {
      method: 'HEAD',
      cache: 'no-store',
    });
    const dateHeader = res.headers.get('date');
    if (!dateHeader) return;
    const server = new Date(dateHeader).getTime();
    if (Number.isNaN(server)) return;
    const t1 = Date.now();
    // Date header has second granularity; add half the round trip and half a
    // second to center the estimate.
    offsetMs = server + 500 + (t1 - t0) / 2 - t1;
  } catch {
    // Keep the device clock.
  }
}

/** Best estimate of the real current time (Date). */
export function serverNow() {
  return new Date(Date.now() + offsetMs);
}

// Sync once on load, and re-sync periodically in case the tab lives long.
if (typeof window !== 'undefined') {
  syncServerTime();
  setInterval(syncServerTime, 5 * 60 * 1000);
}
