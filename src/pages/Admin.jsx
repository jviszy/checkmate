import { useState, useMemo } from 'react';
import {
  CheckCircle2, XCircle, Trash2, Swords, Settings, Users, Flag, RefreshCw, Save,
} from 'lucide-react';
import { Card, Button, StatusPill, TeamMark } from '../components/ui.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import {
  approveTeam, rejectTeam, deleteTeam, updatePlayer, createMatches, updateMatch,
  deleteMatchesForRound, updateTournament, updateTeam, resetData,
} from '../lib/api.js';
import { generateMatches, FORMATS, DEFAULT_FORMAT } from '../lib/matchgen/index.js';
import { fmtScore, fmtDate, teamName } from '../lib/format.js';

const TABS = [
  { id: 'approvals', label: 'Approvals', icon: Flag },
  { id: 'scores', label: 'Teams & Scores', icon: Users },
  { id: 'matches', label: 'Matches', icon: Swords },
  { id: 'round', label: 'Round Control', icon: Settings },
];

export default function Admin() {
  const { teams, players, matches, leaderboard, tournament } = useCheckmate();
  const [tab, setTab] = useState('approvals');

  const pending = teams.filter((t) => t.status === 'pending');

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Organizer panel</h1>
          <p className="mt-1 text-sm text-gray-400">{tournament?.name} · Round {tournament?.currentRound}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { if (confirm('Reset all demo data to seed?')) resetData(); }}>
          <RefreshCw className="h-4 w-4" /> Reset demo data
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex flex-wrap gap-2 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-brandred-500 text-brandred-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            {t.id === 'approvals' && pending.length > 0 && (
              <span className="rounded-full bg-brandred-500 px-1.5 text-xs text-white">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'approvals' && <Approvals pending={pending} players={players} />}
      {tab === 'scores' && <Scores teams={teams} players={players} leaderboard={leaderboard} />}
      {tab === 'matches' && <MatchesAdmin teams={teams} matches={matches} tournament={tournament} />}
      {tab === 'round' && <RoundControl teams={teams} leaderboard={leaderboard} tournament={tournament} />}
    </div>
  );
}

/* ── Approvals ─────────────────────────────────────────────────────────── */
function Approvals({ pending, players }) {
  if (!pending.length) {
    return <Card className="p-10 text-center text-gray-400">No teams awaiting approval. 🎉</Card>;
  }
  return (
    <div className="space-y-4">
      {pending.map((t) => {
        const roster = players.filter((p) => p.teamId === t.id);
        return (
          <Card key={t.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <TeamMark name={t.name} logoUrl={t.logoUrl} size={48} />
              <div>
                <div className="font-medium text-white">{t.name}</div>
                <div className="text-sm text-gray-400">
                  {roster.length} player{roster.length !== 1 ? 's' : ''} · Registered {fmtDate(t.createdAt)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {roster.map((p) => p.displayName).join(', ') || 'No players yet'}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="success" size="sm" onClick={() => approveTeam(t.id)}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
              <Button variant="danger" size="sm" onClick={() => { if (confirm(`Reject and delete "${t.name}"?`)) rejectTeam(t.id); }}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Teams & Scores ────────────────────────────────────────────────────── */
function Scores({ teams, players, leaderboard }) {
  const active = teams.filter((t) => t.status !== 'pending');
  if (!active.length) return <Card className="p-10 text-center text-gray-400">No approved teams yet.</Card>;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-400">
        Edit each player's points — the team total (used for the leaderboard and the top-6 cut) updates automatically.
      </p>
      {active.map((t) => {
        const roster = players.filter((p) => p.teamId === t.id);
        const total = leaderboard.find((r) => r.id === t.id)?.total ?? 0;
        return (
          <Card key={t.id} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 bg-board-900/50 px-5 py-3">
              <div className="flex items-center gap-3">
                <TeamMark name={t.name} logoUrl={t.logoUrl} size={36} />
                <span className="font-medium text-white">{t.name}</span>
                <StatusPill status={t.status} />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">Total <span className="font-mono text-base font-bold text-brandred-400">{fmtScore(total)}</span></span>
                <button
                  className="text-gray-500 hover:text-brandred-400"
                  title="Remove team"
                  onClick={() => { if (confirm(`Delete team "${t.name}" and all its players & matches?`)) deleteTeam(t.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {roster.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-sm text-gray-200">
                    {p.displayName} {p.isCaptain && <span className="text-xs text-brandred-500">(captain)</span>}
                  </span>
                  <input
                    type="number" step="0.5" min="0"
                    defaultValue={p.individualScore}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      if (v !== p.individualScore) updatePlayer(p.id, { individualScore: v });
                    }}
                    className="w-24 rounded-lg border border-white/10 bg-board-900 px-3 py-1.5 text-right font-mono text-white outline-none focus:border-brandred-500"
                  />
                </div>
              ))}
              {!roster.length && <div className="px-5 py-3 text-sm text-gray-500">No players.</div>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Matches ───────────────────────────────────────────────────────────── */
function MatchesAdmin({ teams, matches, tournament }) {
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  const round = tournament?.currentRound ?? 1;
  const activeIds = teams.filter((t) => t.status === 'active' || t.status === 'advanced').map((t) => t.id);
  const roundMatches = useMemo(
    () => matches.filter((m) => m.round === round).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)),
    [matches, round]
  );

  const generate = async () => {
    if (activeIds.length < 2) return alert('Need at least 2 active teams to generate matches.');
    if (roundMatches.length && !confirm(`Replace the ${roundMatches.length} existing match(es) for round ${round}?`)) return;
    await deleteMatchesForRound(round);
    const recs = generateMatches(format, activeIds, round);
    await createMatches(recs);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-medium text-white">Generate fixtures · Round {round}</h3>
          <p className="mt-1 text-sm text-gray-400">{activeIds.length} active teams. Format is swappable as the competition format is finalized.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">Format</span>
            <select
              value={format} onChange={(e) => setFormat(e.target.value)}
              className="rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-white outline-none focus:border-brandred-500"
            >
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          <Button onClick={generate}><Swords className="h-4 w-4" /> Generate</Button>
        </div>
      </Card>

      <div className="space-y-3">
        {roundMatches.length ? roundMatches.map((m) => (
          <MatchRow key={m.id} match={m} teams={teams} />
        )) : (
          <Card className="p-8 text-center text-sm text-gray-400">No matches for round {round}. Generate fixtures above.</Card>
        )}
      </div>
    </div>
  );
}

function MatchRow({ match, teams }) {
  const [a, setA] = useState(match.scoreA);
  const [b, setB] = useState(match.scoreB);

  const save = (status) =>
    updateMatch(match.id, { scoreA: parseFloat(a) || 0, scoreB: parseFloat(b) || 0, status });

  return (
    <Card className="grid grid-cols-1 items-center gap-3 p-4 sm:grid-cols-[1fr_auto_auto]">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-32 truncate text-right text-gray-200">{teamName(teams, match.teamAId)}</span>
        <input type="number" step="0.5" min="0" value={a} onChange={(e) => setA(e.target.value)}
          className="w-16 rounded-lg border border-white/10 bg-board-900 px-2 py-1.5 text-center font-mono text-white outline-none focus:border-brandred-500" />
        <span className="text-gray-500">vs</span>
        <input type="number" step="0.5" min="0" value={b} onChange={(e) => setB(e.target.value)}
          className="w-16 rounded-lg border border-white/10 bg-board-900 px-2 py-1.5 text-center font-mono text-white outline-none focus:border-brandred-500" />
        <span className="w-32 truncate text-gray-200">{teamName(teams, match.teamBId)}</span>
      </div>
      <StatusPill status={match.status} className="justify-self-start sm:justify-self-center" />
      <div className="flex gap-2 justify-self-start sm:justify-self-end">
        <Button size="sm" variant="outline" onClick={() => save('scheduled')}><Save className="h-3.5 w-3.5" /> Save</Button>
        <Button size="sm" variant="success" onClick={() => save('completed')}><CheckCircle2 className="h-3.5 w-3.5" /> Complete</Button>
      </div>
    </Card>
  );
}

/* ── Round control ─────────────────────────────────────────────────────── */
function RoundControl({ teams, leaderboard, tournament }) {
  const [name, setName] = useState(tournament?.name ?? '');
  const [advanceCount, setAdvanceCount] = useState(tournament?.advanceCount ?? 6);

  const advance = async () => {
    const cut = leaderboard.slice(0, advanceCount).map((r) => r.id);
    if (!confirm(`Advance the top ${advanceCount} teams and eliminate the rest? This also moves to round ${(tournament.currentRound ?? 1) + 1}.`)) return;
    await Promise.all(
      leaderboard.map((r) =>
        updateTeam(r.id, { status: cut.includes(r.id) ? 'advanced' : 'eliminated' })
      )
    );
    await updateTournament({ currentRound: (tournament.currentRound ?? 1) + 1 });
  };

  const saveConfig = () =>
    updateTournament({ name, advanceCount: parseInt(advanceCount, 10) || 6 });

  const eliminated = teams.filter((t) => t.status === 'eliminated');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h3 className="font-medium text-white">Competition settings</h3>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-gray-400">Competition name</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-white outline-none focus:border-brandred-500" />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-gray-400">Teams that advance per round</span>
          <input type="number" min="1" value={advanceCount} onChange={(e) => setAdvanceCount(e.target.value)}
            className="w-32 rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-white outline-none focus:border-brandred-500" />
        </label>
        <Button className="mt-5" onClick={saveConfig}><Save className="h-4 w-4" /> Save settings</Button>
      </Card>

      <Card className="p-6">
        <h3 className="font-medium text-white">Advance round</h3>
        <p className="mt-2 text-sm text-gray-400">
          Promote the current top <span className="font-semibold text-brandred-400">{advanceCount}</span> teams to the
          next round and eliminate the rest. The leaderboard carries over.
        </p>
        <div className="mt-4 space-y-1">
          {leaderboard.slice(0, advanceCount).map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg bg-brandred-500/[0.06] px-3 py-1.5 text-sm">
              <span className="text-gray-200">#{r.rank} {r.name}</span>
              <span className="font-mono text-brandred-400">{fmtScore(r.total)}</span>
            </div>
          ))}
        </div>
        <Button variant="danger" className="mt-5" onClick={advance}>
          <Flag className="h-4 w-4" /> Advance top {advanceCount} → Round {(tournament?.currentRound ?? 1) + 1}
        </Button>
        {eliminated.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">{eliminated.length} team(s) eliminated so far.</p>
        )}
      </Card>
    </div>
  );
}
