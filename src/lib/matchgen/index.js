// Pluggable match-generation entry point.
// The competition format is still being decided, so the admin panel calls
// generateMatches(format, ...) and we keep each format isolated. Adding
// `knockout.js` or `swiss.js` later means one new case here — no UI changes.

import { generateRoundRobinMatches } from './roundRobin.js';

export const FORMATS = [
  { id: 'round-robin', label: 'Round robin (everyone plays everyone)' },
  // { id: 'knockout', label: 'Knockout bracket' },   // drop in later
  // { id: 'swiss', label: 'Swiss system' },           // drop in later
];

export const DEFAULT_FORMAT = 'round-robin';

export function generateMatches(format, teamIds, competitionRound, startISO) {
  switch (format) {
    case 'round-robin':
    default:
      return generateRoundRobinMatches(teamIds, competitionRound, startISO);
  }
}
