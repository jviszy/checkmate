// Pluggable match-generation entry point.
// The competition format is still being decided, so the admin panel calls
// generateMatches(format, ...) and we keep each format isolated. Adding
// `knockout.js` or `swiss.js` later means one new case here — no UI changes.

import { generateRoundRobinMatches } from './roundRobin.js';
import { generateFullTournamentPairings } from './tournamentPairing.js';

export { generateFullTournamentPairings };
export * from './tournamentPairing.js';

export const FORMATS = [
  { id: 'tournament-all-students', label: 'All-Students Automated 3-Round Pairing (with Bot matches)' },
  { id: 'round-robin', label: 'Round robin (everyone plays everyone)' },
];

export const DEFAULT_FORMAT = 'tournament-all-students';

export function generateMatches(format, teamIds, competitionRound, startISO) {
  switch (format) {
    case 'round-robin':
      return generateRoundRobinMatches(teamIds, competitionRound, startISO);
    default:
      return generateRoundRobinMatches(teamIds, competitionRound, startISO);
  }
}

