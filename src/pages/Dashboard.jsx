import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Users, Hash, TrendingUp, Crown, ShieldAlert, Star,
} from 'lucide-react';
import { Card, StatusPill, TeamMark, Button } from '../components/ui.jsx';
import GameCard from '../components/GameCard.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtScore } from '../lib/format.js';

export default function Dashboard() {
  const { user } = useAuth();
  const { teams, players, games, leaderboard, winnersPerZone, tournament } = useCheckmate();

  const team = teams.find((t) => t.id === user?.teamId);
  const row = leaderboard.find((r) => r.id === user?.teamId);
  const roster = useMemo(
    () => players.filter((p) => p.teamId === user?.teamId)
      .sort((a, b) => b.individualScore - a.individualScore),
    [players, user]
  );
  // The games this player is actually seated at.
  const myGames = useMemo(
    () => games.filter((g) => g.whitePlayerId === user?.playerId || g.blackPlayerId === user?.playerId),
    [games, user]
  );

  if (!team) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-brandred-500" />
        <h1 className="mt-4 text-2xl font-semibold text-white">No team linked to your account</h1>
        <p className="mt-2 text-gray-400">Register a team or join one with a code to see your dashboard.</p>
        <Button to="/register" className="mt-6">Register or join a team</Button>
      </div>
    );
  }

  const total = row?.total ?? 0;
  const zoneRank = row?.zoneRank ?? '—';
  const zone = row?.zone ?? '—';
  const advancing = row?.advancing;
  const liveGames = myGames.filter((g) => g.status === 'live');
  const upcomingGames = myGames.filter((g) => g.status === 'scheduled');
  const pastGames = myGames.filter((g) => g.status === 'completed');

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-board-grid bg-board-800/60 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <TeamMark name={team.name} logoUrl={team.logoUrl} size={64} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-white">{team.name}</h1>
              <StatusPill status={team.status} />
            </div>
            <p className="mt-1 text-sm text-gray-400">
              Welcome back, {user.displayName}. {team.state || '—'} · {zone} zone · Round {tournament?.currentRound ?? 1}.
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={Hash} label="Zone rank" value={zoneRank === '—' ? '—' : `#${zoneRank}`} />
        <Stat icon={TrendingUp} label="Team score" value={fmtScore(total)} />
        <Stat icon={Users} label="Players" value={roster.length} />
        <Stat
          icon={advancing ? Crown : Trophy}
          label="Advancing"
          value={advancing ? 'Yes' : 'Not yet'}
          accent={advancing}
        />
      </div>

      {!advancing && zoneRank !== '—' && (
        <Card className="mt-4 p-4 text-sm text-gray-300">
          You're <span className="font-semibold text-white">#{zoneRank}</span> in the {zone} zone. The top
          {' '}{winnersPerZone} advance{winnersPerZone === 1 ? 's' : ''} — keep stacking points to take your zone.
        </Card>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        {/* Team leaderboard — members ranked by their contribution */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Team leaderboard</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-400">by points</span>
          </div>
          <Card className="divide-y divide-white/5">
            {roster.map((p, i) => (
              <div key={p.id} className={`flex items-center justify-between px-4 py-3 ${i === 0 ? 'bg-brandred-500/[0.06]' : ''}`}>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      i === 0 ? 'bg-brandred-500 text-board-950'
                        : i < 3 ? 'bg-brandred-500/20 text-brandred-300'
                        : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-white">
                      {p.displayName}
                      {p.isCaptain && <Star className="h-3.5 w-3.5 fill-brandred-500 text-brandred-500" />}
                      {i === 0 && <Crown className="h-3.5 w-3.5 text-brandred-400" />}
                    </div>
                    <div className="text-xs text-gray-500">{p.isCaptain ? 'Captain' : 'Player'}</div>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-brandred-400">{fmtScore(p.individualScore)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-board-900/60 px-4 py-3">
              <span className="text-sm font-medium text-gray-300">Team total</span>
              <span className="font-mono text-lg font-bold text-white">{fmtScore(total)}</span>
            </div>
          </Card>

          <Card className="mt-4 p-4">
            <p className="text-xs text-gray-400">Team join code — share with teammates to let them sign up:</p>
            <p className="mt-1 font-mono text-xl font-bold tracking-widest text-brandred-400">{team.joinCode}</p>
          </Card>
        </div>

        {/* Your games */}
        <div className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your games</h2>
            <Link to="/matches" className="text-sm font-medium text-brandred-400 hover:text-brandred-300">All games</Link>
          </div>

          {liveGames.length > 0 && (
            <>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brandred-400">Live now — it's on!</h3>
              <div className="mb-6 grid gap-4 sm:grid-cols-2">
                {liveGames.map((g) => <GameCard key={g.id} game={g} teams={teams} players={players} canPlay />)}
              </div>
            </>
          )}

          {upcomingGames.length > 0 && (
            <>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Upcoming</h3>
              <div className="mb-6 grid gap-4 sm:grid-cols-2">
                {upcomingGames.map((g) => <GameCard key={g.id} game={g} teams={teams} players={players} canPlay />)}
              </div>
            </>
          )}

          {pastGames.length > 0 && (
            <>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Played</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {pastGames.map((g) => <GameCard key={g.id} game={g} teams={teams} players={players} />)}
              </div>
            </>
          )}

          {myGames.length === 0 && (
            <Card className="p-8 text-center text-sm text-gray-400">
              No games yet. Your boards appear here once organizers pair you — then just hit Play.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }) {
  return (
    <Card className={`p-5 ${accent ? 'border-brandred-500/40 bg-brandred-500/[0.06]' : ''}`}>
      <Icon className={`h-5 w-5 ${accent ? 'text-brandred-400' : 'text-brandred-500'}`} />
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </Card>
  );
}
