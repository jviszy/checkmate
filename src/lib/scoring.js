// Team scoring rule (as specified by Coderina):
// scores are counted PER TEAM, not per member — every member's individual score
// rolls up into the team total. Teams are grouped by geopolitical ZONE, and the
// top N of each zone (winnersPerZone) advance.

import { zoneOfTeam, ZONES } from './zones.js';

/** Sum a team's members' individual scores into the team total. */
export function teamTotal(players) {
  return players.reduce((sum, p) => sum + (Number(p.individualScore) || 0), 0);
}

/**
 * Build a ranked leaderboard from teams + players.
 * Each row is annotated with: total, memberCount, zone, rank (overall),
 * zoneRank (within its zone), and advancing (top `winnersPerZone` of its zone).
 */
export function buildLeaderboard(teams, players, winnersPerZone = 1) {
  const active = teams.filter((t) => t.status === 'active' || t.status === 'advanced');

  const rows = active.map((t) => {
    const members = players.filter((p) => p.teamId === t.id);
    return { ...t, zone: zoneOfTeam(t), total: teamTotal(members), memberCount: members.length };
  });

  // Rank within each zone; the top `winnersPerZone` of a zone advance.
  const byZone = {};
  for (const r of rows) (byZone[r.zone] ||= []).push(r);
  for (const list of Object.values(byZone)) {
    list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    list.forEach((r, i) => { r.zoneRank = i + 1; r.advancing = i < winnersPerZone; });
  }

  // Overall rank by total (used for landing snapshot / global ordering).
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Group leaderboard rows into zones, ordered by the canonical zone list. */
export function groupByZone(rows) {
  const map = {};
  for (const r of rows) (map[r.zone] ||= []).push(r);
  const order = [...ZONES, 'Unzoned'];
  return order
    .filter((z) => map[z]?.length)
    .map((zone) => ({
      zone,
      rows: map[zone].slice().sort((a, b) => a.zoneRank - b.zoneRank),
    }));
}

/** How many teams advance in total: winnersPerZone × zones that have teams. */
export function totalAdvancing(rows, winnersPerZone = 1) {
  const zones = new Set(rows.map((r) => r.zone));
  return zones.size * winnersPerZone;
}

/** Result label for a completed match from team A's perspective. */
export function matchResult(match) {
  if (match.status !== 'completed') return null;
  if (match.scoreA > match.scoreB) return 'A';
  if (match.scoreB > match.scoreA) return 'B';
  return 'draw';
}
