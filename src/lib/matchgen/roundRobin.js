// Round-robin pairing generator (circle method).
// Given a list of active teams, produces fixtures where every team plays
// every other team once. If the count is odd, one team gets a bye each round.

export function roundRobinFixtures(teamIds) {
  const ids = [...teamIds];
  if (ids.length < 2) return [];

  const hasBye = ids.length % 2 !== 0;
  if (hasBye) ids.push(null); // null = bye

  const n = ids.length;
  const rounds = [];
  const arr = [...ids];

  for (let r = 0; r < n - 1; r++) {
    const pairings = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== null && b !== null) pairings.push([a, b]);
    }
    rounds.push(pairings);
    // rotate, keeping the first element fixed
    arr.splice(1, 0, arr.pop());
  }

  return rounds; // array of rounds, each an array of [teamAId, teamBId]
}

/**
 * Flatten the full round-robin into match records for a single competition
 * "round" (every pairing once). Spaces fixtures two hours apart starting at the
 * provided ISO date.
 */
export function generateRoundRobinMatches(teamIds, competitionRound, startISO) {
  const all = roundRobinFixtures(teamIds).flat();
  const start = new Date(startISO || '2026-07-05T10:00:00.000Z').getTime();
  return all.map(([teamAId, teamBId], i) => ({
    round: competitionRound,
    teamAId,
    teamBId,
    scoreA: 0,
    scoreB: 0,
    scheduledAt: new Date(start + i * 2 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
  }));
}
