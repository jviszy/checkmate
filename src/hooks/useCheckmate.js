import { useEffect, useState, useCallback } from 'react';
import {
  listTeams, listPlayers, listMatches, getTournament, onChange,
} from '../lib/api.js';
import { buildLeaderboard } from '../lib/scoring.js';

/**
 * Loads all competition data and keeps it in sync with the data layer.
 * Returns teams, players, matches, tournament, a computed leaderboard, and a
 * loading flag. Re-fetches automatically whenever the data layer changes.
 */
export function useCheckmate() {
  const [state, setState] = useState({
    teams: [], players: [], matches: [], tournament: null,
    leaderboard: [], leaderboardLive: false, loading: true,
  });

  const refresh = useCallback(async () => {
    const [teams, players, matches, tournament] = await Promise.all([
      listTeams(), listPlayers(), listMatches(), getTournament(),
    ]);
    const leaderboard = buildLeaderboard(teams, players, tournament?.advanceCount ?? 6);
    // The public leaderboard stays hidden until the first match has been played;
    // once any match is completed it automatically goes live everywhere.
    const leaderboardLive = matches.some((m) => m.status === 'completed');
    setState({ teams, players, matches, tournament, leaderboard, leaderboardLive, loading: false });
  }, []);

  useEffect(() => {
    refresh();
    return onChange(refresh);
  }, [refresh]);

  return { ...state, refresh };
}
