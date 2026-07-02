import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Users, Hash, TrendingUp, Crown, ShieldAlert, Star,
} from 'lucide-react';
import { Card, StatusPill, TeamMark, Button } from '../components/ui.jsx';
import MatchCard from '../components/MatchCard.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtScore } from '../lib/format.js';

export default function Dashboard() {
  const { user } = useAuth();
  const { teams, players, matches, leaderboard, tournament } = useCheckmate();

  const team = teams.find((t) => t.id === user?.teamId);
  const row = leaderboard.find((r) => r.id === user?.teamId);
  const roster = useMemo(
    () => players.filter((p) => p.teamId === user?.teamId)
      .sort((a, b) => b.individualScore - a.individualScore),
    [players, user]
  );
  const teamMatches = useMemo(
    () => matches
      .filter((m) => m.teamAId === team?.id || m.teamBId === team?.id)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)),
    [matches, team]
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

  const advanceCount = tournament?.advanceCount ?? 6;
  const total = row?.total ?? 0;
  const rank = row?.rank ?? '—';
  const advancing = row?.advancing;
  const upcoming = teamMatches.filter((m) => m.status !== 'completed');
  const previous = teamMatches.filter((m) => m.status === 'completed');

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
              Welcome back, {user.displayName}. Round {tournament?.currentRound ?? 1}.
            </p>
          </div>
        </div>
        {team.status === 'pending' && (
          <div className="rounded-lg bg-brandred-500/10 px-4 py-2 text-sm text-brandred-300">
            Awaiting organizer approval
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={Hash} label="Current rank" value={rank === '—' ? '—' : `#${rank}`} />
        <Stat icon={TrendingUp} label="Team score" value={fmtScore(total)} />
        <Stat icon={Users} label="Players" value={roster.length} />
        <Stat
          icon={advancing ? Crown : Trophy}
          label="Advancing"
          value={advancing ? 'Yes' : 'Not yet'}
          accent={advancing}
        />
      </div>

      {!advancing && rank !== '—' && team.status !== 'pending' && (
        <Card className="mt-4 p-4 text-sm text-gray-300">
          You're <span className="font-semibold text-white">#{rank}</span>. The top {advanceCount} teams
          advance — keep stacking points to break into the cut.
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

        {/* Matches */}
        <div className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your matches</h2>
            <Link to="/matches" className="text-sm font-medium text-brandred-400 hover:text-brandred-300">All fixtures</Link>
          </div>

          {upcoming.length > 0 && (
            <>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Upcoming</h3>
              <div className="mb-6 grid gap-4 sm:grid-cols-2">
                {upcoming.map((m) => <MatchCard key={m.id} match={m} teams={teams} highlightTeamId={team.id} />)}
              </div>
            </>
          )}

          {previous.length > 0 && (
            <>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Previous</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {previous.map((m) => <MatchCard key={m.id} match={m} teams={teams} highlightTeamId={team.id} />)}
              </div>
            </>
          )}

          {teamMatches.length === 0 && (
            <Card className="p-8 text-center text-sm text-gray-400">
              No matches scheduled for your team yet. Fixtures appear once organizers generate the round.
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
