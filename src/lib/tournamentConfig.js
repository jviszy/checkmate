// ─────────────────────────────────────────────────────────────────────────
// Tournament Configuration
// Centralized configuration for competition window, rounds, registration,
// and single-team exceptions.
// ─────────────────────────────────────────────────────────────────────────

// Server timezone setting (WAT / West Africa Time, UTC+1)
export const SERVER_TIMEZONE_OFFSET = '+01:00';

// Item 4: Registration closes on Thursday 12/11/2026 at 18:00 (Server timezone)
export const REGISTRATION_DEADLINE_ISO = '2026-11-12T18:00:00+01:00';

// Item 9: Competition has 3 rounds, each lasting 10 minutes
export const ROUND_COUNT = 3;
export const ROUND_DURATION_MINUTES = 10;
export const ROUND_DURATION_MS = ROUND_DURATION_MINUTES * 60 * 1000;

// Item 11: Competition window on Friday 13/11/2026, 10:00 to 10:45
export const COMPETITION_WINDOW = {
  DATE: '2026-11-13',
  START_TIME: '10:00',
  END_TIME: '10:45',
  TIMEZONE: '+01:00',
  START_ISO: '2026-11-13T10:00:00+01:00',
  END_ISO: '2026-11-13T10:45:00+01:00',
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
 * Check whether registration is currently open.
 * Uses the server timezone comparison (+01:00).
 */
export function isRegistrationOpen(nowDate = new Date()) {
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
