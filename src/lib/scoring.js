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
 * Deterministic evaluation of Nationals qualification based on total registrations.
 *
 * Rule 1 (under 200 teams): Every registered team advances to the nationals.
 * Rule 2 (200 or more teams): Exactly 100 teams qualify, distributed across zones
 * based on performance deterministically.
 */
export function evaluateNationalsQualification(teams = [], players = []) {
  const totalRegistered = teams.length;
  const is200OrMore = totalRegistered >= NATIONALS_THRESHOLD;
  const ruleApplied = is200OrMore ? NATIONALS_RULES.AT_LEAST_200 : NATIONALS_RULES.UNDER_200;
  const ruleTitle = is200OrMore
    ? '200+ Registrations — Top 100 Zone Performance Distribution'
    : 'Under 200 Registrations — Full Advancement';
  const ruleDescription = is200OrMore
    ? `Total registrations (${totalRegistered}) reached 200 or more (treated as the 200+ case). Exactly 100 qualifying places are distributed across zones based on performance.`
    : `Total registrations (${totalRegistered}) is under 200. Every registered team advances to the nationals.`;

  // Compute team performance metrics
  const teamsWithScores = teams.map((t) => {
    const teamPlayers = players.filter((p) => p.teamId === t.id);
    const total = teamTotal(teamPlayers);
    const maxScore = maxMemberScore(teamPlayers);
    const zone = zoneOfTeam(t);
    return {
      ...t,
      zone,
      total,
      maxScore,
      memberCount: teamPlayers.length,
    };
  });

  // Group teams by zone
  const zoneMap = {};
  for (const t of teamsWithScores) {
    (zoneMap[t.zone] ||= []).push(t);
  }

  // Sort teams within each zone deterministically:
  // 1. Team total score DESC
  // 2. Max member individual score DESC
  // 3. Team name ASC
  // 4. Team id ASC
  for (const zone of Object.keys(zoneMap)) {
    zoneMap[zone].sort((a, b) => (
      b.total - a.total ||
      b.maxScore - a.maxScore ||
      a.name.localeCompare(b.name) ||
      String(a.id).localeCompare(String(b.id))
    ));
  }

  const activeZones = Object.keys(zoneMap);
  const qualifyingTeamIds = new Set();
  const zoneBreakdown = [];

  if (!is200OrMore) {
    // Under 200: Every registered team advances
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
  } else {
    // 200 or more: Exactly 100 places distributed across zones based on performance
    const targetQualifiers = Math.min(NATIONALS_CAP, totalRegistered);
    const numZones = activeZones.length;

    // Step 1: Base representation to guarantee distribution across zones
    // Each active zone gets up to 5 base places (or all their teams if < 5)
    const BASE_PER_ZONE = numZones > 0 ? Math.min(5, Math.floor(targetQualifiers / (numZones * 2)) || 1) : 0;
    const zoneBase = {};
    let totalBaseAllocated = 0;

    for (const zone of activeZones) {
      const count = zoneMap[zone].length;
      const base = Math.min(count, BASE_PER_ZONE);
      zoneBase[zone] = base;
      totalBaseAllocated += base;
    }

    // Step 2: Proportional performance merit quota for remaining spots
    const remainingMeritSpots = Math.max(0, targetQualifiers - totalBaseAllocated);
    const zonePerformance = {};
    let totalNationalPerformance = 0;

    for (const zone of activeZones) {
      const perf = zoneMap[zone].reduce((s, t) => s + t.total, 0);
      zonePerformance[zone] = perf;
      totalNationalPerformance += perf;
    }

    const zoneMerit = {};
    const zoneRemainders = [];

    for (const zone of activeZones) {
      const count = zoneMap[zone].length;
      const capacityRemaining = count - zoneBase[zone];
      if (capacityRemaining <= 0) {
        zoneMerit[zone] = 0;
        continue;
      }

      // If no games played yet (total points = 0), distribute proportionally to team registrations
      const share = totalNationalPerformance > 0
        ? (zonePerformance[zone] / totalNationalPerformance)
        : (count / totalRegistered);

      const exactQuota = share * remainingMeritSpots;
      const integerPart = Math.min(capacityRemaining, Math.floor(exactQuota));
      const remainder = exactQuota - Math.floor(exactQuota);

      zoneMerit[zone] = integerPart;
      zoneRemainders.push({
        zone,
        remainder,
        performance: zonePerformance[zone],
        capacityRemaining: capacityRemaining - integerPart,
      });
    }

    let allocatedSpots = totalBaseAllocated + Object.values(zoneMerit).reduce((a, b) => a + b, 0);

    // Step 3: Hamilton-Hare Largest Remainder Method for unallocated spots
    // Order by remainder DESC, then zone performance DESC, then zone name ASC
    zoneRemainders.sort((a, b) => (
      b.remainder - a.remainder ||
      b.performance - a.performance ||
      a.zone.localeCompare(b.zone)
    ));

    for (const entry of zoneRemainders) {
      if (allocatedSpots >= targetQualifiers) break;
      if (entry.capacityRemaining > 0) {
        zoneMerit[entry.zone] = (zoneMerit[entry.zone] || 0) + 1;
        entry.capacityRemaining -= 1;
        allocatedSpots += 1;
      }
    }

    // Step 4: Fallback if capacity constraints left any spots open
    if (allocatedSpots < targetQualifiers) {
      for (const zone of activeZones) {
        const canTake = zoneMap[zone].length - (zoneBase[zone] + (zoneMerit[zone] || 0));
        const toAdd = Math.min(canTake, targetQualifiers - allocatedSpots);
        if (toAdd > 0) {
          zoneMerit[zone] = (zoneMerit[zone] || 0) + toAdd;
          allocatedSpots += toAdd;
        }
        if (allocatedSpots >= targetQualifiers) break;
      }
    }

    // Assign qualifying teams per zone
    for (const zone of activeZones) {
      const spotsForZone = zoneBase[zone] + (zoneMerit[zone] || 0);
      const qualified = zoneMap[zone].slice(0, spotsForZone);
      qualified.forEach((t) => qualifyingTeamIds.add(t.id));

      zoneBreakdown.push({
        zone,
        teamsRegistered: zoneMap[zone].length,
        performanceScore: zonePerformance[zone] || 0,
        baseSpots: zoneBase[zone],
        meritSpots: zoneMerit[zone] || 0,
        allocatedSpots: spotsForZone,
        qualifiedTeamIds: qualified.map((t) => t.id),
      });
    }
  }

  // Audit metadata payload
  const auditSummary = {
    evaluatedAt: new Date().toISOString(),
    totalRegistrations: totalRegistered,
    ruleApplied,
    ruleTitle,
    ruleDescription,
    qualifyingTarget: is200OrMore ? NATIONALS_CAP : totalRegistered,
    actualQualifyingCount: qualifyingTeamIds.size,
    zoneBreakdown,
  };

  return {
    is200OrMore,
    ruleApplied,
    ruleTitle,
    ruleDescription,
    totalRegistrations: totalRegistered,
    qualifyingTarget: is200OrMore ? NATIONALS_CAP : totalRegistered,
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
    const members = players.filter((p) => p.teamId === t.id);
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
