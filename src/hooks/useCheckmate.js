import { useEffect, useState, useCallback } from 'react';
import {
  listTeams, listPlayers, listMatches, listGames, getTournament, onChange,
} from '../lib/api.js';
import { buildLeaderboard } from '../lib/scoring.js';

/**
 * Loads all competition data and keeps it in sync with the data layer —
 * including live games, so the scoreboard updates automatically as results
 * come in (across tabs/devices via the realtime channel in api.js).
 */
export function useCheckmate() {
  const [state, setState] = useState({
    teams: [], players: [], matches: [], games: [], tournament: null,
    leaderboard: [], leaderboardLive: false, hasTeams: false, winnersPerZone: 1, loading: true,
  });

  const refresh = useCallback(async () => {
    const [teams, players, matches, games, tournament] = await Promise.all([
      listTeams(), listPlayers(), listMatches(), listGames(), getTournament(),
    ]);
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
