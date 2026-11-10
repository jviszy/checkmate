// Team scoring rule & Nationals qualification logic (as specified by Coderina):
// Scores are counted PER TEAM, not per member — every member's individual score
// rolls up into the team total. Teams are grouped by geopolitical ZONE.
//
// Nationals Qualification Rule:
// - If total team registrations are under 200 (< 200), EVERY registered team advances to the nationals.
// - If total team registrations reach 200 or more (>= 200), exactly 100 teams qualify for the nationals.
//   The 100 places are distributed across zones based on performance deterministically
//   (Hamilton-Hare largest remainder apportionment based on aggregate zone performance points,
//   with base representation to prevent any zone from being shut out).
// - Exactly 200 is treated as the "200 or more" case.

import { zoneOfTeam, ZONES } from './zones.js';

export const NATIONALS_THRESHOLD = 200;
export const NATIONALS_CAP = 100;

export const NATIONALS_RULES = {
  UNDER_200: 'RULE_UNDER_200_ALL_ADVANCE',
  AT_LEAST_200: 'RULE_200_PLUS_TOP_100_ZONE_MERIT',
  LOW_REGISTRATION_ALL_ADVANCE: 'RULE_LOW_REGISTRATION_ALL_ADVANCE',
};

/** Sum a team's members' individual scores into the team total. */
export function teamTotal(players) {
  return players.reduce((sum, p) => sum + (Number(p.individualScore) || 0), 0);
}

/** Max player individual score on a team, used as secondary tiebreaker. */
export function maxMemberScore(players) {
  return players.reduce((max, p) => Math.max(max, Number(p.individualScore) || 0), 0);
}

/**
 * Cuts a team's members down to strictly at most 5 members.
 * Preserves captains first, followed by members with the highest individual scores.
 */
export function getEffectiveTeamMembers(teamId, players) {
  const members = players.filter((p) => p.teamId === teamId);
  if (members.length <= 5) return members;
  return [...members].sort((a, b) => (
    (b.isCaptain ? 1 : 0) - (a.isCaptain ? 1 : 0) ||
    (Number(b.individualScore) || 0) - (Number(a.individualScore) || 0) ||
    String(a.displayName || '').localeCompare(String(b.displayName || '')) ||
    String(a.id).localeCompare(String(b.id))
  )).slice(0, 5);
}

/**
 * Item 10: Because of low registration, all registered teams advance to nationals.
 * Mark every team as qualified for nationals and make sure the bracket and advancement logic
 * reflects this without requiring normal qualification results.
 */
export function evaluateNationalsQualification(teams = [], players = []) {
  const totalRegistered = teams.length;
  const ruleApplied = NATIONALS_RULES.LOW_REGISTRATION_ALL_ADVANCE;
  const ruleTitle = 'All Registered Teams Advance to Nationals';
  const ruleDescription = 'Because of low registration, all registered teams advance to nationals directly without requiring normal qualification results.';

  // Compute team performance metrics
  const teamsWithScores = teams.map((t) => {
    const teamPlayers = getEffectiveTeamMembers(t.id, players);
    const total = teamTotal(teamPlayers);
    const maxScore = maxMemberScore(teamPlayers);
    const zone = zoneOfTeam(t);
    return {
      ...t,
      zone,
      total,
      maxScore,
      memberCount: teamPlayers.length,
      nationalsQualified: true,
      advancing: true,
    };
  });

  // Group teams by zone
  const zoneMap = {};
  for (const t of teamsWithScores) {
    (zoneMap[t.zone] ||= []).push(t);
  }

  const qualifyingTeamIds = new Set();
  const zoneBreakdown = [];

  // Every single registered team advances to nationals
  for (const [zone, zTeams] of Object.entries(zoneMap)) {
    const perfScore = zTeams.reduce((s, t) => s + t.total, 0);
    zTeams.forEach((t) => qualifyingTeamIds.add(t.id));
    zoneBreakdown.push({
      zone,
      teamsRegistered: zTeams.length,
      performanceScore: perfScore,
      baseSpots: zTeams.length,
      meritSpots: 0,
      allocatedSpots: zTeams.length,
      qualifiedTeamIds: zTeams.map((t) => t.id),
    });
  }

  // Handle case when no zones exist yet
  teams.forEach((t) => qualifyingTeamIds.add(t.id));

  const auditSummary = {
    evaluatedAt: new Date().toISOString(),
    totalRegistrations: totalRegistered,
    ruleApplied,
    ruleTitle,
    ruleDescription,
    qualifyingTarget: totalRegistered,
    actualQualifyingCount: qualifyingTeamIds.size,
    zoneBreakdown,
  };

  return {
    is200OrMore: false,
    ruleApplied,
    ruleTitle,
    ruleDescription,
    totalRegistrations: totalRegistered,
    qualifyingTarget: totalRegistered,
    actualQualifyingCount: qualifyingTeamIds.size,
    qualifyingTeamIds,
    zoneBreakdown,
    auditSummary,
  };
}

/**
 * Build a ranked leaderboard from teams + players.
 * Each row is annotated with:
 *  - total: team score sum
 *  - memberCount: number of roster members
 *  - zone: geopolitical zone
 *  - rank: overall national rank
 *  - zoneRank: rank within its zone
 *  - nationalsQualified: boolean (advances to Nationals under active qualification rule)
 *  - nationalsRule: applied qualification rule ID
 *  - advancing: alias for nationalsQualified
 */
export function buildLeaderboard(teams, players, winnersPerZone = 1) {
  const active = teams.filter((t) => t.status === 'active' || t.status === 'advanced');

  // Evaluate Nationals qualification on the active tournament cohort
  const nationalsEval = evaluateNationalsQualification(active, players);

  const rows = active.map((t) => {
    const members = getEffectiveTeamMembers(t.id, players);
    const total = teamTotal(members);
    const isQualified = nationalsEval.qualifyingTeamIds.has(t.id);
    return {
      ...t,
      zone: zoneOfTeam(t),
      total,
      memberCount: members.length,
      nationalsQualified: isQualified,
      nationalsRule: nationalsEval.ruleApplied,
      nationalsRuleTitle: nationalsEval.ruleTitle,
      advancing: isQualified,
    };
  });

  // Rank within each zone
  const byZone = {};
  for (const r of rows) (byZone[r.zone] ||= []).push(r);
  for (const list of Object.values(byZone)) {
    list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    list.forEach((r, i) => { r.zoneRank = i + 1; });
  }

  // Overall rank by total
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Group leaderboard rows into zones, ordered by canonical zone list. */
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

/** Total teams advancing to Nationals based on active qualification rule. */
export function totalAdvancing(rows, winnersPerZone = 1) {
  if (!rows || rows.length === 0) return 0;
  return rows.filter((r) => r.nationalsQualified || r.advancing).length;
}

/** Result label for a completed match from team A's perspective. */
export function matchResult(match) {
  if (match.status !== 'completed') return null;
  if (match.scoreA > match.scoreB) return 'A';
  if (match.scoreB > match.scoreA) return 'B';
  return 'draw';
}

/**
 * Helper to generate a realistic simulated dataset of 200+ teams across Nigeria's
 * 6 zones for auditing the 200+ qualification logic in the Organizer panel.
 */
export function generateAuditSimulationTeams(targetCount = 220) {
  const zoneDistribution = [
    { zone: 'South West', state: 'Lagos', weight: 0.30 },
    { zone: 'North Central', state: 'FCT (Abuja)', weight: 0.18 },
    { zone: 'South South', state: 'Rivers', weight: 0.16 },
    { zone: 'North West', state: 'Kano', weight: 0.14 },
    { zone: 'South East', state: 'Enugu', weight: 0.12 },
    { zone: 'North East', state: 'Borno', weight: 0.10 },
  ];

  const teams = [];
  const players = [];

  let teamIndex = 1;
  for (const dist of zoneDistribution) {
    const zoneCount = Math.round(targetCount * dist.weight);
    for (let i = 0; i < zoneCount; i++) {
      const id = `sim_team_${teamIndex}`;
      const name = `${dist.zone} Team ${i + 1}`;
      teams.push({
        id,
        name,
        state: dist.state,
        zone: dist.zone,
        status: 'active',
        joinCode: `SIM${teamIndex}`,
        coachId: `sim_coach_${dist.zone.replace(/\s+/g, '_')}`,
        coachName: `Coach ${dist.zone}`,
        coachEmail: `coach.${dist.zone.toLowerCase().replace(/\s+/g, '')}@example.com`,
      });

      // Assign realistic performance points with some variance
      const memberCount = 4;
      for (let m = 1; m <= memberCount; m++) {
        const score = parseFloat((Math.random() * 4).toFixed(1));
        players.push({
          id: `sim_p_${teamIndex}_${m}`,
          teamId: id,
          displayName: `Member ${m} of ${name}`,
          email: `m${m}.${id}@example.com`,
          individualScore: score,
          isCaptain: m === 1,
        });
      }
      teamIndex++;
    }
  }

  return { teams, players };
}
