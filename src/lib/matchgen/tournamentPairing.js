// ─────────────────────────────────────────────────────────────────────────
// Tournament Pairing Engine
// Generates 3-round tournament pairings for all registered students.
//
// Requirements:
// - Item 3: Automatically pair all students within a team with opponents from
//   other teams for each round. Unmatched players are paired with a bot opponent.
//   Every player ends matched to a real opponent or bot. Bot matches count toward
//   the 3-round requirement.
// - Item 9: Exactly 3 rounds, each lasting 10 minutes. Round count and duration
//   are modeled as configuration values. Produces 3 rounds per player.
// - Item 11: Competition window on Friday 13/11/2026, 10:00 to 10:45. No round
//   starts before 10:00 or runs past 10:45.
// ─────────────────────────────────────────────────────────────────────────

import {
  ROUND_COUNT,
  ROUND_DURATION_MINUTES,
  ROUND_DURATION_MS,
  COMPETITION_WINDOW,
} from '../tournamentConfig.js';
import { INITIAL_FEN } from '../seed.js';

export const BOT_TEAM_ID = 'bot_team';
export const BOT_TEAM_NAME = 'Checkmate Bot Team';
export const BOT_PLAYER_ID_PREFIX = 'bot_player';
export const BOT_PLAYER_NAME = 'Checkmate Bot';

/**
 * Calculate scheduled start times for each round within the competition window.
 * Window: 10:00 to 10:45 on Friday 13/11/2026.
 * All rounds start at or after 10:00 and conclude by 10:45.
 */
export function getRoundScheduledTime(roundNumber) {
  // Base date: 2026-11-13
  const [year, month, day] = COMPETITION_WINDOW.DATE.split('-').map(Number);
  // Schedule rounds 15 minutes apart from the window start (WAT / UTC+1)
  const [winHour, winMinute] = COMPETITION_WINDOW.START_TIME.split(':').map(Number);
  const totalMins = winHour * 60 + winMinute + (roundNumber - 1) * 15;
  const hour = Math.floor(totalMins / 60);
  const minute = totalMins % 60;

  // Verify within window constraints (start <= round start, round end <= window end)
  const [startHour, startMinute] = COMPETITION_WINDOW.START_TIME.split(':').map(Number);
  const [endHour, endMinute] = COMPETITION_WINDOW.END_TIME.split(':').map(Number);
  const startMins = startHour * 60 + startMinute;
  const endMins = endHour * 60 + endMinute;
  const roundStartMins = hour * 60 + minute;

  if (roundStartMins < startMins || roundStartMins + ROUND_DURATION_MINUTES > endMins) {
    throw new Error(`Round start time ${hour}:${minute} is outside competition window ${COMPETITION_WINDOW.START_TIME} - ${COMPETITION_WINDOW.END_TIME}`);
  }

  // Format as ISO with +01:00 offset
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+01:00`;
}

/**
 * Check if a player ID belongs to a bot opponent.
 */
export function isBotPlayer(playerId) {
  if (!playerId) return false;
  return playerId.startsWith(BOT_PLAYER_ID_PREFIX) || playerId === 'bot_opponent';
}

/**
 * Check if a team ID belongs to the bot team.
 */
export function isBotTeam(teamId) {
  return teamId === BOT_TEAM_ID;
}

/**
 * Generate 3-round pairings for all registered teams and their students.
 * Every student on every team is guaranteed exactly 3 games (one per round),
 * paired either with an opponent student from another team or with a bot opponent.
 */
export function generateFullTournamentPairings(teams, players) {
  const activeTeams = teams.filter((t) => t.status !== 'eliminated');
  const teamMap = new Map(activeTeams.map((t) => [t.id, t]));

  // Index active players by team
  const playersByTeam = new Map();
  for (const t of activeTeams) {
    const roster = players.filter((p) => p.teamId === t.id);
    playersByTeam.set(t.id, roster);
  }

  const allMatches = [];
  const allGames = [];

  // Generate for each of the 3 configured rounds
  for (let r = 1; r <= ROUND_COUNT; r++) {
    const scheduledAt = getRoundScheduledTime(r);
    const roundMatches = [];
    const roundGames = [];

    // Pair teams using round-robin rotation per round
    const teamIds = activeTeams.map((t) => t.id);
    const pairedTeamIds = new Set();
    const teamPairings = [];

    // If we have at least 2 teams, pair them up
    if (teamIds.length >= 2) {
      // Rotation offset for round r so teams play different opponents each round
      const rotated = [...teamIds];
      const offset = (r - 1) % (rotated.length - 1 || 1);
      if (offset > 0) {
        const item = rotated.splice(1, offset);
        rotated.push(...item);
      }

      for (let i = 0; i < Math.floor(rotated.length / 2); i++) {
        const a = rotated[i];
        const b = rotated[rotated.length - 1 - i];
        if (a && b && a !== b) {
          teamPairings.push([a, b]);
          pairedTeamIds.add(a);
          pairedTeamIds.add(b);
        }
      }
    }

    // Teams that could not be paired with another team in this round
    const unpairedTeams = activeTeams.filter((t) => !pairedTeamIds.has(t.id));

    // Process matched team pairs
    for (let pIdx = 0; pIdx < teamPairings.length; pIdx++) {
      const [teamAId, teamBId] = teamPairings[pIdx];
      const matchId = `match_r${r}_t${pIdx + 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      roundMatches.push({
        id: matchId,
        round: r,
        teamAId,
        teamBId,
        scoreA: 0,
        scoreB: 0,
        scheduledAt,
        status: 'scheduled',
      });

      const rosterA = playersByTeam.get(teamAId) || [];
      const rosterB = playersByTeam.get(teamBId) || [];
      const maxCount = Math.max(rosterA.length, rosterB.length);

      for (let b = 0; b < maxCount; b++) {
        const playerA = rosterA[b] || null;
        const playerB = rosterB[b] || null;
        // Alternate colors by board and round
        const aIsWhite = (b + r) % 2 === 0;

        if (playerA && playerB) {
          // Both teams have a player for this board
          roundGames.push({
            matchId,
            round: r,
            whiteTeamId: aIsWhite ? teamAId : teamBId,
            whitePlayerId: aIsWhite ? playerA.id : playerB.id,
            blackTeamId: aIsWhite ? teamBId : teamAId,
            blackPlayerId: aIsWhite ? playerB.id : playerA.id,
            fen: INITIAL_FEN,
            pgn: '',
            status: 'scheduled',
            clockMs: ROUND_DURATION_MS,
            incrementMs: 3000,
            scheduledAt,
          });
        } else if (playerA && !playerB) {
          // Team A player has no available opponent from Team B -> Pair with Bot!
          const botPlayerId = `${BOT_PLAYER_ID_PREFIX}_r${r}_${playerA.id}`;
          roundGames.push({
            matchId,
            round: r,
            whiteTeamId: aIsWhite ? teamAId : BOT_TEAM_ID,
            whitePlayerId: aIsWhite ? playerA.id : botPlayerId,
            blackTeamId: aIsWhite ? BOT_TEAM_ID : teamAId,
            blackPlayerId: aIsWhite ? botPlayerId : playerA.id,
            fen: INITIAL_FEN,
            pgn: '',
            status: 'scheduled',
            clockMs: ROUND_DURATION_MS,
            incrementMs: 3000,
            scheduledAt,
            isBotMatch: true,
          });
        } else if (playerB && !playerA) {
          // Team B player has no available opponent from Team A -> Pair with Bot!
          const botPlayerId = `${BOT_PLAYER_ID_PREFIX}_r${r}_${playerB.id}`;
          roundGames.push({
            matchId,
            round: r,
            whiteTeamId: aIsWhite ? BOT_TEAM_ID : teamBId,
            whitePlayerId: aIsWhite ? botPlayerId : playerB.id,
            blackTeamId: aIsWhite ? teamBId : BOT_TEAM_ID,
            blackPlayerId: aIsWhite ? playerB.id : botPlayerId,
            fen: INITIAL_FEN,
            pgn: '',
            status: 'scheduled',
            clockMs: ROUND_DURATION_MS,
            incrementMs: 3000,
            scheduledAt,
            isBotMatch: true,
          });
        }
      }
    }

    // Process unpaired teams -> Every player on the team plays a bot for this round
    for (let uIdx = 0; uIdx < unpairedTeams.length; uIdx++) {
      const uTeam = unpairedTeams[uIdx];
      const matchId = `match_r${r}_bot_u${uIdx + 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      roundMatches.push({
        id: matchId,
        round: r,
        teamAId: uTeam.id,
        teamBId: BOT_TEAM_ID,
        scoreA: 0,
        scoreB: 0,
        scheduledAt,
        status: 'scheduled',
      });

      const roster = playersByTeam.get(uTeam.id) || [];
      for (let b = 0; b < roster.length; b++) {
        const player = roster[b];
        const aIsWhite = (b + r) % 2 === 0;
        const botPlayerId = `${BOT_PLAYER_ID_PREFIX}_r${r}_${player.id}`;

        roundGames.push({
          matchId,
          round: r,
          whiteTeamId: aIsWhite ? uTeam.id : BOT_TEAM_ID,
          whitePlayerId: aIsWhite ? player.id : botPlayerId,
          blackTeamId: aIsWhite ? BOT_TEAM_ID : uTeam.id,
          blackPlayerId: aIsWhite ? botPlayerId : player.id,
          fen: INITIAL_FEN,
          pgn: '',
          status: 'scheduled',
          clockMs: ROUND_DURATION_MS,
          incrementMs: 3000,
          scheduledAt,
          isBotMatch: true,
        });
      }
    }

    allMatches.push(...roundMatches);
    allGames.push(...roundGames);
  }

  return {
    matches: allMatches,
    games: allGames,
    roundCount: ROUND_COUNT,
    roundDurationMinutes: ROUND_DURATION_MINUTES,
    competitionWindow: COMPETITION_WINDOW,
  };
}

/**
 * Find, per round, the teams that have no match scheduled.
 * A team counts as assigned in a round when it appears as teamA or teamB
 * on any existing match for that round.
 */
export function findUnassignedTeamsByRound(teams, existingMatches) {
  const eligible = teams.filter((t) => t.status !== 'eliminated' && !isBotTeam(t.id));
  const result = new Map();
  for (let r = 1; r <= ROUND_COUNT; r++) {
    const assigned = new Set();
    for (const m of existingMatches) {
      if (m.round !== r) continue;
      if (m.teamAId) assigned.add(m.teamAId);
      if (m.teamBId) assigned.add(m.teamBId);
    }
    result.set(r, eligible.filter((t) => !assigned.has(t.id)));
  }
  return result; // Map<round, Team[]>
}

/** Build the board games for one team-vs-team match (bot fills uneven rosters). */
function buildPairGames(matchId, r, scheduledAt, teamAId, teamBId, rosterA, rosterB) {
  const games = [];
  const maxCount = Math.max(rosterA.length, rosterB.length);
  for (let b = 0; b < maxCount; b++) {
    const playerA = rosterA[b] || null;
    const playerB = rosterB[b] || null;
    const aIsWhite = (b + r) % 2 === 0;
    const base = {
      matchId, round: r, fen: INITIAL_FEN, pgn: '', status: 'scheduled',
      clockMs: ROUND_DURATION_MS, incrementMs: 3000, scheduledAt,
    };
    if (playerA && playerB) {
      games.push({
        ...base,
        whiteTeamId: aIsWhite ? teamAId : teamBId,
        whitePlayerId: aIsWhite ? playerA.id : playerB.id,
        blackTeamId: aIsWhite ? teamBId : teamAId,
        blackPlayerId: aIsWhite ? playerB.id : playerA.id,
      });
    } else if (playerA || playerB) {
      const player = playerA || playerB;
      const teamId = playerA ? teamAId : teamBId;
      const botPlayerId = `${BOT_PLAYER_ID_PREFIX}_r${r}_${player.id}`;
      games.push({
        ...base,
        whiteTeamId: aIsWhite ? teamId : BOT_TEAM_ID,
        whitePlayerId: aIsWhite ? player.id : botPlayerId,
        blackTeamId: aIsWhite ? BOT_TEAM_ID : teamId,
        blackPlayerId: aIsWhite ? botPlayerId : player.id,
        isBotMatch: true,
      });
    }
  }
  return games;
}

/**
 * Rebuild the board games for EXISTING matches (using their real ids).
 * `seatedByRound` lists players who already have a kept game in a round
 * (live/completed) and must not be reseated there. Bot-team matches give
 * every roster player a bot board; uneven rosters are bot-filled.
 */
export function generateGamesForMatches(matches, players, seatedByRound = new Map()) {
  const rosterOf = (teamId) => players.filter((p) => p.teamId === teamId);
  const games = [];
  for (const m of matches) {
    const r = m.round;
    if (!r || r < 1 || r > ROUND_COUNT) continue;
    const seated = seatedByRound.get(r) || new Set();
    const scheduledAt = m.scheduledAt || getRoundScheduledTime(r);

    if (isBotTeam(m.teamAId) || isBotTeam(m.teamBId)) {
      const teamId = isBotTeam(m.teamAId) ? m.teamBId : m.teamAId;
      const roster = rosterOf(teamId).filter((p) => !seated.has(p.id));
      roster.forEach((player, b) => {
        const aIsWhite = (b + r) % 2 === 0;
        const botPlayerId = `${BOT_PLAYER_ID_PREFIX}_r${r}_${player.id}`;
        games.push({
          matchId: m.id, round: r,
          whiteTeamId: aIsWhite ? teamId : BOT_TEAM_ID,
          whitePlayerId: aIsWhite ? player.id : botPlayerId,
          blackTeamId: aIsWhite ? BOT_TEAM_ID : teamId,
          blackPlayerId: aIsWhite ? botPlayerId : player.id,
          fen: INITIAL_FEN, pgn: '', status: 'scheduled',
          clockMs: ROUND_DURATION_MS, incrementMs: 3000, scheduledAt,
          isBotMatch: true,
        });
      });
    } else {
      const rosterA = rosterOf(m.teamAId).filter((p) => !seated.has(p.id));
      const rosterB = rosterOf(m.teamBId).filter((p) => !seated.has(p.id));
      games.push(...buildPairGames(m.id, r, scheduledAt, m.teamAId, m.teamBId, rosterA, rosterB));
    }
  }
  return games;
}

/**
 * Generate pairings ONLY for teams that are missing a match in one or more
 * rounds, without touching existing matches/games. Missing teams in a round
 * are paired against each other; an odd one out plays the bot team.
 */
export function generateMissingPairings(teams, players, existingMatches) {
  const unassignedByRound = findUnassignedTeamsByRound(teams, existingMatches);
  const rosterOf = (teamId) => players.filter((p) => p.teamId === teamId);

  const newMatches = [];
  const newGames = [];

  for (let r = 1; r <= ROUND_COUNT; r++) {
    const missing = unassignedByRound.get(r) || [];
    if (!missing.length) continue;
    const scheduledAt = getRoundScheduledTime(r);

    // Pair missing teams with each other two at a time
    let idx = 0;
    let pairNo = 0;
    while (idx + 1 < missing.length) {
      const teamA = missing[idx];
      const teamB = missing[idx + 1];
      idx += 2;
      pairNo += 1;
      const matchId = `match_r${r}_fill${pairNo}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      newMatches.push({
        id: matchId, round: r, teamAId: teamA.id, teamBId: teamB.id,
        scoreA: 0, scoreB: 0, scheduledAt, status: 'scheduled',
      });
      newGames.push(...buildPairGames(matchId, r, scheduledAt, teamA.id, teamB.id, rosterOf(teamA.id), rosterOf(teamB.id)));
    }

    // Odd team out plays the bot team
    if (idx < missing.length) {
      const uTeam = missing[idx];
      const matchId = `match_r${r}_fillbot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      newMatches.push({
        id: matchId, round: r, teamAId: uTeam.id, teamBId: BOT_TEAM_ID,
        scoreA: 0, scoreB: 0, scheduledAt, status: 'scheduled',
      });
      const roster = rosterOf(uTeam.id);
      for (let b = 0; b < roster.length; b++) {
        const player = roster[b];
        const aIsWhite = (b + r) % 2 === 0;
        const botPlayerId = `${BOT_PLAYER_ID_PREFIX}_r${r}_${player.id}`;
        newGames.push({
          matchId, round: r,
          whiteTeamId: aIsWhite ? uTeam.id : BOT_TEAM_ID,
          whitePlayerId: aIsWhite ? player.id : botPlayerId,
          blackTeamId: aIsWhite ? BOT_TEAM_ID : uTeam.id,
          blackPlayerId: aIsWhite ? botPlayerId : player.id,
          fen: INITIAL_FEN, pgn: '', status: 'scheduled',
          clockMs: ROUND_DURATION_MS, incrementMs: 3000, scheduledAt,
          isBotMatch: true,
        });
      }
    }
  }

  return { matches: newMatches, games: newGames };
}
