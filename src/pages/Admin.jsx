import { useState, useMemo } from 'react';
import { Trash2, Swords, Settings, Users, Flag, RefreshCw, Save, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Button, StatusPill, TeamMark } from '../components/ui.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import {
  deleteTeam, updatePlayer, createMatches,
  deleteMatchesForRound, updateTournament, updateTeam, loadSampleData, clearData,
  createGame, completeGame,
} from '../lib/api.js';
import { generateMatches, FORMATS, DEFAULT_FORMAT } from '../lib/matchgen/index.js';
import { fmtScore, teamName } from '../lib/format.js';

const TABS = [
  { id: 'scores', label: 'Teams & Scores', icon: Users },
  { id: 'matches', label: 'Matches', icon: Swords },
  { id: 'round', label: 'Round Control', icon: Settings },
];

export default function Admin() {
  const { teams, players, matches, games, leaderboard, tournament } = useCheckmate();
  const [tab, setTab] = useState('scores');

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Organizer panel</h1>
          <p className="mt-1 text-sm text-gray-400">{tournament?.name} · Round {tournament?.currentRound}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { if (confirm('Load the sample teams, players and a live game? This replaces current data.')) loadSampleData(); }}>
            <RefreshCw className="h-4 w-4" /> Load sample data
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { if (confirm('Clear ALL data back to an empty competition?')) clearData(); }}>
            <Trash2 className="h-4 w-4" /> Clear all
          </Button>
        </div>
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
          </button>
        ))}
      </div>

      {tab === 'scores' && <Scores teams={teams} players={players} leaderboard={leaderboard} />}
      {tab === 'matches' && <MatchesAdmin teams={teams} players={players} matches={matches} games={games} tournament={tournament} />}
      {tab === 'round' && <RoundControl teams={teams} leaderboard={leaderboard} tournament={tournament} />}
    </div>
  );
}

/* ── Teams & Scores ────────────────────────────────────────────────────── */
function Scores({ teams, players, leaderboard }) {
  const active = teams;
  if (!active.length) return <Card className="p-10 text-center text-gray-400">No teams yet. Teams appear here as they register.</Card>;

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
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{t.name}</span>
                    <StatusPill status={t.status} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-brandred-300">{zoneOfTeam(t)}</span>
                    <select
                      value={t.state || ''} onChange={(e) => updateTeam(t.id, { state: e.target.value })}
                      className="rounded border border-white/10 bg-board-900 px-1.5 py-0.5 text-gray-300 outline-none focus:border-brandred-500"
                    >
                      <option value="">Set state…</option>
                      {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
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

/* ── Matches & board games ─────────────────────────────────────────────── */
function captainOf(players, teamId) {
  const roster = players.filter((p) => p.teamId === teamId);
  return roster.find((p) => p.isCaptain) || roster[0] || null;
}

function MatchesAdmin({ teams, players, matches, games, tournament }) {
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  const round = tournament?.currentRound ?? 1;
  const activeTeams = teams.filter((t) => t.status === 'active' || t.status === 'advanced');
  const activeIds = activeTeams.map((t) => t.id);
  const roundGames = useMemo(() => games.filter((g) => g.round === round), [games, round]);

  // Group active teams by geopolitical zone; teams only play within their zone.
  const zoneGroups = useMemo(() => {
    const g = {};
    for (const t of activeTeams) (g[zoneOfTeam(t)] ||= []).push(t);
    return g;
  }, [activeTeams]);
  const playableZones = Object.entries(zoneGroups).filter(([, ts]) => ts.length >= 2);

  // Generate a round-robin WITHIN each zone, plus a playable board (captains) per fixture.
  const generate = async () => {
    if (!playableZones.length) return alert('Each zone needs at least 2 teams. Add more teams (or states) first.');
    const existing = matches.filter((m) => m.round === round);
    if (existing.length && !confirm(`Replace round ${round}'s ${existing.length} fixture(s) and their games?`)) return;
    await deleteMatchesForRound(round);
    for (const [, zoneTeams] of playableZones) {
      const recs = generateMatches(format, zoneTeams.map((t) => t.id), round);
      const created = await createMatches(recs);
      for (const m of created) {
        const wc = captainOf(players, m.teamAId);
        const bc = captainOf(players, m.teamBId);
        if (wc && bc) {
          await createGame({ matchId: m.id, round, whiteTeamId: m.teamAId, whitePlayerId: wc.id, blackTeamId: m.teamBId, blackPlayerId: bc.id });
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-medium text-white">Generate fixtures · Round {round}</h3>
          <p className="mt-1 text-sm text-gray-400">
            {activeIds.length} active teams across {Object.keys(zoneGroups).length} zone(s); {playableZones.length} zone(s) have enough teams to play. Round-robin runs within each zone.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)}
              className="rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-white outline-none focus:border-brandred-500">
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          <Button onClick={generate}><Swords className="h-4 w-4" /> Generate</Button>
        </div>
      </Card>

      <NewGameForm teams={activeTeams} players={players} round={round} />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">Board games · Round {round}</h3>
        <div className="space-y-3">
          {roundGames.length ? roundGames.map((g) => (
            <GameRow key={g.id} game={g} teams={teams} players={players} />
          )) : (
            <Card className="p-8 text-center text-sm text-gray-400">No board games yet. Generate fixtures or add a board above.</Card>
          )}
        </div>
      </div>
    </div>
  );
}

function NewGameForm({ teams, players, round }) {
  const [wT, setWT] = useState(''); const [wP, setWP] = useState('');
  const [bT, setBT] = useState(''); const [bP, setBP] = useState('');
  const roster = (tid) => players.filter((p) => p.teamId === tid);

  const create = async () => {
    if (!wT || !wP || !bT || !bP) return alert('Pick both players.');
    if (wT === bT) return alert('Pick two different teams.');
    await createGame({ round, whiteTeamId: wT, whitePlayerId: wP, blackTeamId: bT, blackPlayerId: bP });
    setWP(''); setBP('');
  };

  const Select = ({ value, onChange, children }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-white/10 bg-board-900 px-2 py-1.5 text-sm text-white outline-none focus:border-brandred-500">
      {children}
    </select>
  );

  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-white">Add a board game</h3>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Select value={wT} onChange={(v) => { setWT(v); setWP(''); }}>
          <option value="">White team…</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Select value={wP} onChange={setWP}>
          <option value="">Player…</option>
          {roster(wT).map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
        </Select>
        <span className="text-gray-500">vs</span>
        <Select value={bT} onChange={(v) => { setBT(v); setBP(''); }}>
          <option value="">Black team…</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Select value={bP} onChange={setBP}>
          <option value="">Player…</option>
          {roster(bT).map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
        </Select>
        <Button size="sm" onClick={create}>Add board</Button>
      </div>
    </Card>
  );
}

function GameRow({ game, teams, players }) {
  const pName = (id) => players.find((p) => p.id === id)?.displayName || 'TBD';
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="text-sm">
        <span className="text-gray-200">{teamName(teams, game.whiteTeamId)}</span>
        <span className="text-gray-500"> ({pName(game.whitePlayerId)}) vs </span>
        <span className="text-gray-200">{teamName(teams, game.blackTeamId)}</span>
        <span className="text-gray-500"> ({pName(game.blackPlayerId)})</span>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill status={game.status} />
        <Link to={`/play/${game.id}`}>
          <Button size="sm" variant="outline"><Play className="h-3.5 w-3.5" /> Open board</Button>
        </Link>
        {game.status !== 'completed' && (
          <div className="flex gap-1">
            <Button size="sm" variant="success" onClick={() => completeGame(game.id, 'white')}>1–0</Button>
            <Button size="sm" variant="outline" onClick={() => completeGame(game.id, 'draw')}>½</Button>
            <Button size="sm" variant="success" onClick={() => completeGame(game.id, 'black')}>0–1</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── Round control ─────────────────────────────────────────────────────── */
function RoundControl({ teams, leaderboard, tournament }) {
  const [name, setName] = useState(tournament?.name ?? '');
  const [winnersPerZone, setWinnersPerZone] = useState(tournament?.winnersPerZone ?? 1);

  const zones = groupByZone(leaderboard);
  const advancingRows = leaderboard.filter((r) => r.advancing);
  const advancingIds = advancingRows.map((r) => r.id);
  const totalAdv = totalAdvancing(leaderboard, tournament?.winnersPerZone ?? 1);

  const advance = async () => {
    if (!advancingIds.length) return alert('No standings yet — play some games first.');
    if (!confirm(`Advance the top ${tournament?.winnersPerZone ?? 1} of each zone (${advancingIds.length} team(s)) and eliminate the rest? Moves to round ${(tournament.currentRound ?? 1) + 1}.`)) return;
    await Promise.all(
      leaderboard.map((r) =>
        updateTeam(r.id, { status: advancingIds.includes(r.id) ? 'advanced' : 'eliminated' })
      )
    );
    await updateTournament({ currentRound: (tournament.currentRound ?? 1) + 1 });
  };

  const saveConfig = () =>
    updateTournament({ name, winnersPerZone: parseInt(winnersPerZone, 10) || 1 });

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
          <span className="mb-1 block text-gray-400">Winners that advance per zone</span>
          <input type="number" min="1" value={winnersPerZone} onChange={(e) => setWinnersPerZone(e.target.value)}
            className="w-32 rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-white outline-none focus:border-brandred-500" />
        </label>
        <p className="mt-2 text-xs text-gray-500">
          Total advancing = winners per zone × zones in play (currently {totalAdv} across {zones.length} zone(s)).
        </p>
        <Button className="mt-5" onClick={saveConfig}><Save className="h-4 w-4" /> Save settings</Button>
      </Card>

      <Card className="p-6">
        <h3 className="font-medium text-white">Advance round</h3>
        <p className="mt-2 text-sm text-gray-400">
          Promote the top <span className="font-semibold text-brandred-400">{tournament?.winnersPerZone ?? 1}</span> of
          each zone and eliminate the rest.
        </p>
        <div className="mt-4 space-y-3">
          {zones.map(({ zone, rows }) => (
            <div key={zone}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{zone}</div>
              {rows.filter((r) => r.advancing).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-brandred-500/[0.06] px-3 py-1.5 text-sm">
                  <span className="text-gray-200">#{r.zoneRank} {r.name}</span>
                  <span className="font-mono text-brandred-400">{fmtScore(r.total)}</span>
                </div>
              ))}
            </div>
          ))}
          {!zones.length && <p className="text-sm text-gray-500">No standings yet.</p>}
        </div>
        <Button variant="danger" className="mt-5" onClick={advance}>
          <Flag className="h-4 w-4" /> Advance zone winners → Round {(tournament?.currentRound ?? 1) + 1}
        </Button>
        {eliminated.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">{eliminated.length} team(s) eliminated so far.</p>
        )}
      </Card>
    </div>
  );
}
