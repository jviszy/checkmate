import { useEffect, useState, useCallback } from 'react';
import {
  listTeams, listPlayers, listMatches, listGames, getTournament, onChange, trimOversizedTeams,
} from '../lib/api.js';
import { buildLeaderboard } from '../lib/scoring.js';

/**
 * Loads all competition data and keeps it in sync with the data layer —
 * including live games, so the scoreboard updates automatically as results
 * come in (across tabs/devices via the realtime channel in api.js).
 * Enforces that any team with more than 5 members is cut down to only 5 members.
 */
export function useCheckmate() {
  const [state, setState] = useState({
    teams: [], players: [], matches: [], games: [], tournament: null,
    leaderboard: [], leaderboardLive: false, hasTeams: false, winnersPerZone: 1, loading: true,
  });

  const refresh = useCallback(async () => {
    let [teams, rawPlayers, matches, games, tournament] = await Promise.all([
      listTeams(), listPlayers(), listMatches(), listGames(), getTournament(),
    ]);

    // Check if any team has more than 5 members
    const teamCounts = {};
    let hasOversizedTeam = false;
    for (const p of rawPlayers) {
      if (p.teamId) {
        teamCounts[p.teamId] = (teamCounts[p.teamId] || 0) + 1;
        if (teamCounts[p.teamId] > 5) hasOversizedTeam = true;
      }
    }

    // If any team has > 5 members, cut down to 5 members and prune database
    let players = rawPlayers;
    if (hasOversizedTeam) {
      // Trigger background pruning in database
      trimOversizedTeams().catch(console.warn);

      // Cut in-memory roster to at most 5 members per team immediately
      const byTeam = {};
      const nonTeam = [];
      for (const p of rawPlayers) {
        if (p.teamId) {
          (byTeam[p.teamId] ||= []).push(p);
        } else {
          nonTeam.push(p);
        }
      }

      const trimmedPlayers = [...nonTeam];
      for (const tPlayers of Object.values(byTeam)) {
        if (tPlayers.length > 5) {
          const sorted = [...tPlayers].sort((a, b) => (
            (b.isCaptain ? 1 : 0) - (a.isCaptain ? 1 : 0) ||
            (Number(b.individualScore) || 0) - (Number(a.individualScore) || 0)
          ));
          trimmedPlayers.push(...sorted.slice(0, 5));
        } else {
          trimmedPlayers.push(...tPlayers);
        }
      }
      players = trimmedPlayers;
    }

    const winnersPerZone = tournament?.winnersPerZone ?? 1;
    const leaderboard = buildLeaderboard(teams, players, winnersPerZone);
    // Registration has started once any team is active.
    const hasTeams = teams.some((t) => t.status === 'active' || t.status === 'advanced');
    // Standings go live once matches officially start — i.e. any game is live or
    // done (or a match has been scored) — then auto-appear everywhere.
    const leaderboardLive =
      games.some((g) => g.status === 'live' || g.status === 'completed') ||
      matches.some((m) => m.status === 'live' || m.status === 'completed');
    setState({ teams, players, matches, games, tournament, leaderboard, leaderboardLive, hasTeams, winnersPerZone, loading: false });
  }, []);

  useEffect(() => {
    refresh();
    return onChange(refresh);
  }, [refresh]);

  return { ...state, refresh };
}
