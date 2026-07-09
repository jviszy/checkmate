import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Hash, TrendingUp, Play, Star, Trophy } from 'lucide-react';
import { Card, Button, StatusPill, TeamMark } from '../components/ui.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import { useAuth } from '../context/AuthContext.jsx';
import { createTeam } from '../lib/api.js';
import { fmtScore, teamById } from '../lib/format.js';

export default function Coach() {
  const { user } = useAuth();
  const { teams, players, games, leaderboard } = useCheckmate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const myTeams = teams.filter((t) => t.coachId === user?.coachId);

  const addTeam = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await createTeam({ name: name.trim(), coachId: user.coachId, status: 'active' });
    setName('');
    setBusy(false);
  };

  const totalPlayers = myTeams.reduce((n, t) => n + players.filter((p) => p.teamId === t.id).length, 0);
  const liveGames = games.filter(
    (g) => g.status === 'live' && myTeams.some((t) => t.id === g.whiteTeamId || t.id === g.blackTeamId)
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-white">Coach dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">Welcome, {user?.displayName}. Manage all your teams in one place.</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={Users} label="Teams" value={myTeams.length} />
        <Stat icon={Hash} label="Players" value={totalPlayers} />
        <Stat icon={Play} label="Live games" value={liveGames.length} accent={liveGames.length > 0} />
        <Stat icon={Trophy} label="Best rank" value={bestRank(myTeams, leaderboard)} />
      </div>

      {/* Create team */}
      <Card className="mb-8 p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Add a team</h2>
        <form onSubmit={addTeam} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Team name (e.g. Royal Knights)"
            className="flex-1 rounded-lg border border-white/10 bg-board-900 px-3 py-2.5 text-white placeholder-gray-500 outline-none focus:border-brandred-500"
          />
          <Button as="button" type="submit" disabled={busy}>
            <Plus className="h-4 w-4" /> {busy ? 'Adding…' : 'Add team'}
          </Button>
        </form>
        <p className="mt-2 text-xs text-gray-500">Teams go live right away and get a join code to share with players.</p>
      </Card>

      {/* Teams */}
      {myTeams.length === 0 ? (
        <Card className="p-10 text-center text-gray-400">You haven't added any teams yet. Add your first team above.</Card>
      ) : (
        <div className="space-y-5">
          {myTeams.map((t) => {
            const roster = players.filter((p) => p.teamId === t.id).sort((a, b) => b.individualScore - a.individualScore);
            const row = leaderboard.find((r) => r.id === t.id);
            const teamGames = games
              .filter((g) => g.whiteTeamId === t.id || g.blackTeamId === t.id)
              .sort((a, b) => (a.status === 'live' ? -1 : 1) - (b.status === 'live' ? -1 : 1));
            return (
              <Card key={t.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-board-900/50 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <TeamMark name={t.name} logoUrl={t.logoUrl} size={40} />
                    <div>
                      <div className="flex items-center gap-2 font-medium text-white">{t.name} <StatusPill status={t.status} /></div>
                      <div className="text-xs text-gray-500">Join code <span className="font-mono text-brandred-400">{t.joinCode}</span></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    {row && <span>Rank <span className="font-semibold text-white">#{row.rank}</span></span>}
                    <span className="inline-flex items-center gap-1"><TrendingUp className="h-4 w-4 text-brandred-400" /> <span className="font-mono font-bold text-white">{fmtScore(row?.total ?? 0)}</span></span>
                  </div>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  {/* Roster */}
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Roster</h4>
                    <ul className="space-y-1.5">
                      {roster.length ? roster.map((p) => (
                        <li key={p.id} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 text-gray-200">
                            {p.displayName}
                            {p.isCaptain && <Star className="h-3 w-3 fill-brandred-500 text-brandred-500" />}
                          </span>
                          <span className="font-mono text-brandred-400">{fmtScore(p.individualScore)}</span>
                        </li>
                      )) : <li className="text-sm text-gray-500">No players joined yet.</li>}
                    </ul>
                  </div>

                  {/* Games */}
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Games</h4>
                    {teamGames.length ? (
                      <ul className="space-y-2">
                        {teamGames.map((g) => (
                          <li key={g.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-board-900/40 px-3 py-2 text-sm">
                            <span className="text-gray-300">
                              vs {teamById(teams, g.whiteTeamId === t.id ? g.blackTeamId : g.whiteTeamId)?.name || 'TBD'}
                            </span>
                            <div className="flex items-center gap-2">
                              <StatusPill status={g.status} />
                              <Link to={`/play/${g.id}`} className="text-brandred-400 hover:text-brandred-300">
                                {g.status === 'completed' ? 'Review' : g.status === 'live' ? 'Play' : 'Open'}
                              </Link>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-gray-500">No games scheduled yet.</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function bestRank(myTeams, leaderboard) {
  const ranks = myTeams.map((t) => leaderboard.find((r) => r.id === t.id)?.rank).filter(Boolean);
  return ranks.length ? `#${Math.min(...ranks)}` : '—';
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
