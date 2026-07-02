// Team scoring rule (as specified by Coderina):
// scores are counted PER TEAM, not per member — every member's individual
// score rolls up into the team total, and the top N teams advance.

/** Sum a team's members' individual scores into the team total. */
export function teamTotal(players) {
  return players.reduce((sum, p) => sum + (Number(p.individualScore) || 0), 0);
}

/**
 * Build a ranked leaderboard from teams + players.
 * Returns active teams sorted by total score (desc), each annotated with
 * rank, total, memberCount, and whether they're in the advancing cut.
 */
export function buildLeaderboard(teams, players, advanceCount = 6) {
  const active = teams.filter((t) => t.status === 'active' || t.status === 'advanced');

  const rows = active.map((t) => {
    const members = players.filter((p) => p.teamId === t.id);
    return {
      ...t,
      total: teamTotal(members),
      memberCount: members.length,
    };
  });

  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return rows.map((row, i) => ({
    ...row,
    rank: i + 1,
    advancing: i < advanceCount,
  }));
}

/** Result label for a completed match from team A's perspective. */
export function matchResult(match) {
  if (match.status !== 'completed') return null;
  if (match.scoreA > match.scoreB) return 'A';
  if (match.scoreB > match.scoreA) return 'B';
  return 'draw';
}
