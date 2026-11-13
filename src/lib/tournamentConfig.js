// ─────────────────────────────────────────────────────────────────────────
// Tournament Configuration
// Centralized configuration for competition window, rounds, registration,
// and single-team exceptions.
// ─────────────────────────────────────────────────────────────────────────

// Server timezone setting (WAT / West Africa Time, UTC+1)
export const SERVER_TIMEZONE_OFFSET = '+01:00';

// Item 4: Registration closes on Thursday 12/11/2026 at 18:00 (Server timezone)
export const REGISTRATION_DEADLINE_ISO = '2026-11-12T18:00:00+01:00';

// Hard close: when true, registration is closed for everyone regardless of
// the visitor's device clock (the deadline check below uses local time).
export const REGISTRATION_HARD_CLOSED = true;

// Item 9: Competition has 3 rounds, each lasting 10 minutes
export const ROUND_COUNT = 3;
export const ROUND_DURATION_MINUTES = 10;
export const ROUND_DURATION_MS = ROUND_DURATION_MINUTES * 60 * 1000;

// Item 11: Competition window on Friday 13/11/2026.
// Originally 10:00-10:45; the close was extended to 12:00 on competition day
// because corrupted pairings kept most students off their boards for the
// first part of the window.
export const COMPETITION_WINDOW = {
  DATE: '2026-11-13',
  START_TIME: '10:30',
  END_TIME: '12:00',
  TIMEZONE: '+01:00',
  START_ISO: '2026-11-13T10:30:00+01:00',
  END_ISO: '2026-11-13T12:00:00+01:00',
};

// Item 5: Exactly one team of 5 members plus 1 coach may register without an email address
export const EXEMPT_EMAIL_TEAM = {
  name: 'The Legend 1',
  coach: {
    name: 'Jimmy Olugbemi',
    email: 'jimmyolugbemi@gmail.com',
  },
  players: [
    { displayName: 'Desola', isCaptain: true },
    { displayName: 'Mayokun Asani', isCaptain: false },
    { displayName: 'Alvin Okunbor', isCaptain: false },
    { displayName: 'Sophia Samson', isCaptain: false },
    { displayName: 'Jadesola Jasmine Oguniyi', isCaptain: false },
  ],
};

/**
 * Competition phase relative to the fixed window (10:00–10:45 WAT on 13/11/2026).
 * 'before'  → boards are not open yet
 * 'open'    → boards are open, play allowed
 * 'closed'  → window has ended, no more play
 */
export function getCompetitionPhase(nowDate = new Date()) {
  const now = nowDate.getTime();
  const start = new Date(COMPETITION_WINDOW.START_ISO).getTime();
  const end = new Date(COMPETITION_WINDOW.END_ISO).getTime();
  if (now < start) return 'before';
  if (now >= end) return 'closed';
  return 'open';
}

/** Milliseconds until the boards open (0 if already open or closed). */
export function msUntilCompetitionStart(nowDate = new Date()) {
  return Math.max(0, new Date(COMPETITION_WINDOW.START_ISO).getTime() - nowDate.getTime());
}

/** Milliseconds until the boards close (0 if already closed). */
export function msUntilCompetitionEnd(nowDate = new Date()) {
  return Math.max(0, new Date(COMPETITION_WINDOW.END_ISO).getTime() - nowDate.getTime());
}

/**
 * Check whether registration is currently open.
 * Uses the server timezone comparison (+01:00).
 */
export function isRegistrationOpen(nowDate = new Date()) {
  if (REGISTRATION_HARD_CLOSED) return false;
  const deadline = new Date(REGISTRATION_DEADLINE_ISO).getTime();
  return nowDate.getTime() <= deadline;
}

/**
 * Returns a human-readable registration deadline description.
 */
export function getRegistrationDeadlineText() {
  return 'Thursday 12/11/2026 at 18:00 (WAT)';
}

/**
 * Check whether a team is the designated email-exempt team.
 */
export function isEmailExemptTeam(name) {
  if (!name) return false;
  return name.trim().toLowerCase() === EXEMPT_EMAIL_TEAM.name.toLowerCase();
}

/**
 * Generate a clearly marked placeholder for a player whose email is pending.
 */
export function makePendingEmailPlaceholder(playerName, teamName = 'The Legend 1') {
  const slug = (playerName || 'player').toLowerCase().replace(/[^a-z0-9]/g, '.');
  return `[PENDING_DETAILS:${slug}@placeholder.${teamName.toLowerCase().replace(/[^a-z0-9]/g, '')}.checkmate]`;
}
