import { useState, useMemo, useEffect } from 'react';
import { Trash2, Swords, Settings, Users, Flag, RefreshCw, Save, Play, Edit, ClipboardList, Search, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Button, StatusPill, TeamMark } from '../components/ui.jsx';
import TeamEditorModal from '../components/TeamEditorModal.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  deleteTeam, updatePlayer, createMatches,
  deleteMatchesForRound, updateTournament, updateTeam, loadSampleData, clearData,
  createGame, completeGame, listAuditLogs, createAuditLog,
} from '../lib/api.js';
import { generateMatches, FORMATS, DEFAULT_FORMAT } from '../lib/matchgen/index.js';
import { fmtScore, teamName } from '../lib/format.js';
import { STATES, zoneOfTeam } from '../lib/zones.js';
import { evaluateNationalsQualification, generateAuditSimulationTeams } from '../lib/scoring.js';

const TABS = [
  { id: 'scores', label: 'Teams & Scores', icon: Users },
  { id: 'matches', label: 'Matches', icon: Swords },
  { id: 'round', label: 'Round Control', icon: Settings },
  { id: 'logs', label: 'Audit Log', icon: ClipboardList },
];

export default function Admin() {
  const { user } = useAuth();
  const { teams, players, matches, games, leaderboard, tournament } = useCheckmate();
  const [tab, setTab] = useState('scores');
  const [editingTeam, setEditingTeam] = useState(null);

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

      {tab === 'scores' && (
        <Scores
          teams={teams}
          players={players}
          leaderboard={leaderboard}
          onEditTeam={(t) => setEditingTeam(t)}
          currentUser={user}
        />
      )}
      {tab === 'matches' && <MatchesAdmin teams={teams} players={players} matches={matches} games={games} tournament={tournament} />}
      {tab === 'round' && <RoundControl teams={teams} players={players} leaderboard={leaderboard} tournament={tournament} currentUser={user} />}
      {tab === 'logs' && <AuditLogsView />}

      {editingTeam && (
        <TeamEditorModal
          team={editingTeam}
          players={players}
          isAdmin={true}
          currentUser={user}
          onClose={() => setEditingTeam(null)}
        />
      )}
    </div>
  );
}

function Scores({ teams, players, leaderboard, onEditTeam, currentUser }) {
  const [query, setQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const filteredTeams = useMemo(() => {
    let list = teams;
    if (selectedTeamId) {
      list = list.filter((t) => t.id === selectedTeamId);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || (t.state && t.state.toLowerCase().includes(q)));
    }
    return list;
  }, [teams, selectedTeamId, query]);

  if (!teams.length) return <Card className="p-10 text-center text-gray-400">No teams yet. Teams appear here as they register.</Card>;

  const handleScoreChange = async (p, newScore) => {
    if (newScore !== p.individualScore) {
      await updatePlayer(p.id, { individualScore: newScore });
      const parentTeam = teams.find((t) => t.id === p.teamId);
      if (currentUser) {
        await createAuditLog({
          adminEmail: currentUser.email,
          adminName: currentUser.displayName || currentUser.email,
          action: 'UPDATE_SCORE',
          targetType: 'player',
          targetId: p.id,
          targetName: p.displayName,
          details: `Changed score of ${p.displayName} (team "${parentTeam?.name || p.teamId}") from ${p.individualScore} to ${newScore}`,
        });
      }
    }
  };

  const handleDeleteTeam = async (t) => {
    if (confirm(`Delete team "${t.name}" and all its players & matches?`)) {
      await deleteTeam(t.id);
      if (currentUser) {
        await createAuditLog({
          adminEmail: currentUser.email,
          adminName: currentUser.displayName || currentUser.email,
          action: 'DELETE_TEAM',
          targetType: 'team',
          targetId: t.id,
          targetName: t.name,
          details: `Deleted team "${t.name}" (${t.state || 'no state'}) and all associated players and games.`,
        });
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Team Picker & Filter Bar */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams by name or state…"
            className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Pick team:</label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="rounded-lg border border-white/10 bg-board-900 px-3 py-1.5 text-sm text-white outline-none focus:border-brandred-500"
          >
            <option value="">All Teams ({teams.length})</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.state || 'No State'})</option>
            ))}
          </select>
        </div>
      </Card>

      <p className="text-sm text-gray-400">
        Pick a team to inspect or edit team details and members. Changes made by administrators are recorded in the audit log.
      </p>

      {filteredTeams.map((t) => {
        const roster = players.filter((p) => p.teamId === t.id);
        const total = leaderboard.find((r) => r.id === t.id)?.total ?? 0;
        return (
          <Card key={t.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-board-900/50 px-5 py-3">
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
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">Total <span className="font-mono text-base font-bold text-brandred-400">{fmtScore(total)}</span></span>
                <Button size="sm" variant="outline" onClick={() => onEditTeam(t)}>
                  <Edit className="h-3.5 w-3.5" /> Edit team & roster
                </Button>
                <button
                  className="rounded p-1 text-gray-500 transition-colors hover:bg-brandred-500/20 hover:text-brandred-400"
                  title="Remove team"
                  onClick={() => handleDeleteTeam(t)}
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
                    {p.phone && <span className="ml-2 text-xs text-gray-500">· {p.phone}</span>}
                  </span>
                  <input
                    type="number" step="0.5" min="0"
                    defaultValue={p.individualScore}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      handleScoreChange(p, v);
                    }}
                    className="w-24 rounded-lg border border-white/10 bg-board-900 px-3 py-1.5 text-right font-mono text-white outline-none focus:border-brandred-500"
                  />
                </div>
              ))}
              {!roster.length && <div className="px-5 py-3 text-sm text-gray-500">No players on this team. Click "Edit team & roster" to add members.</div>}
            </div>
          </Card>
        );
      })}

      {!filteredTeams.length && (
        <Card className="p-8 text-center text-sm text-gray-400">
          No teams match your search or filter.
        </Card>
      )}
    </div>
  );
}

/* ── Audit Logs View ───────────────────────────────────────────────────── */
function AuditLogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const data = await listAuditLogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-white">Administrator Audit Trail</h3>
          <p className="text-xs text-gray-400">
            Records of team and member modifications performed by admins on coaches' behalf.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchLogs}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh logs
        </Button>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-gray-400">Loading audit trail…</Card>
      ) : !logs.length ? (
        <Card className="p-8 text-center text-sm text-gray-400">
          No administrator actions recorded yet. Admin modifications to teams and members will appear here.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-white/5">
            {logs.map((log) => {
              const dateStr = log.timestamp || log.createdAt;
              const formattedDate = dateStr ? new Date(dateStr).toLocaleString() : 'Just now';
              return (
                <div key={log.id} className="p-4 text-sm hover:bg-white/[0.02]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-brandred-500/20 px-2 py-0.5 text-xs font-semibold text-brandred-400 uppercase">
                        {log.action}
                      </span>
                      <span className="font-medium text-white">{log.targetName || log.targetId}</span>
                      <span className="text-xs text-gray-500">({log.targetType})</span>
                    </div>
                    <span className="text-xs text-gray-500">{formattedDate}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-300">{log.details}</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Modified by: <span className="text-gray-400">{log.adminName ? `${log.adminName} (${log.adminEmail})` : log.adminEmail}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
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

/* ── Round control & Nationals Qualification ─────────────────────────────── */
function RoundControl({ teams, players, leaderboard, tournament, currentUser }) {
  const [name, setName] = useState(tournament?.name ?? '');
  const [winnersPerZone, setWinnersPerZone] = useState(tournament?.winnersPerZone ?? 1);
  const [showSim, setShowSim] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState('');

  // Evaluate Nationals qualification on actual live data
  const liveNationals = useMemo(
    () => evaluateNationalsQualification(teams, players),
    [teams, players]
  );

  // Evaluate Nationals qualification on simulated 200+ dataset for testing/auditing
  const simData = useMemo(() => generateAuditSimulationTeams(220), []);
  const simNationals = useMemo(
    () => evaluateNationalsQualification(simData.teams, simData.players),
    [simData]
  );

  const activeResult = showSim ? simNationals : liveNationals;

  const handleApplyNationals = async () => {
    if (!teams.length) return alert('No teams registered yet.');
    const confirmMsg = liveNationals.is200OrMore
      ? `Apply Nationals Qualification rule for 200+ teams? Only the top 100 teams (${liveNationals.actualQualifyingCount} qualified across ${liveNationals.zoneBreakdown.length} zones based on performance) will advance. Remaining teams will be marked eliminated.`
      : `Apply Nationals Qualification rule for under 200 teams? All ${teams.length} registered teams will advance to the Nationals.`;

    if (!confirm(confirmMsg)) return;

    setApplying(true);
    try {
      const qualifyingIds = liveNationals.qualifyingTeamIds;
      await Promise.all(
        teams.map((t) =>
          updateTeam(t.id, { status: qualifyingIds.has(t.id) ? 'advanced' : 'eliminated' })
        )
      );

      // Record in Audit Log
      if (currentUser) {
        const zoneDetails = liveNationals.zoneBreakdown
          .map((z) => `${z.zone}: ${z.allocatedSpots} spots (${z.teamsRegistered} teams, ${z.performanceScore} pts)`)
          .join('; ');

        await createAuditLog({
          adminEmail: currentUser.email,
          adminName: currentUser.displayName || currentUser.email,
          action: 'NATIONALS_QUALIFICATION_RULE_EVALUATED',
          targetType: 'team',
          targetId: liveNationals.ruleApplied,
          targetName: liveNationals.ruleTitle,
          details: `Evaluated ${liveNationals.ruleTitle}. Total registrations = ${teams.length} (${liveNationals.is200OrMore ? '>= 200 case' : '< 200 case'}). Qualified = ${liveNationals.actualQualifyingCount} teams. Zone allocations: ${zoneDetails}`,
        });
      }

      setApplySuccess(`Nationals qualification applied successfully! (${liveNationals.actualQualifyingCount} teams advanced, recorded in Audit Log).`);
      setTimeout(() => setApplySuccess(''), 6000);
    } catch (err) {
      alert(`Failed to apply qualification: ${err.message}`);
    } finally {
      setApplying(false);
    }
  };

  const saveConfig = () =>
    updateTournament({ name, winnersPerZone: parseInt(winnersPerZone, 10) || 1 });

  const eliminated = teams.filter((t) => t.status === 'eliminated');

  return (
    <div className="space-y-6">
      {/* ── Section: Nationals Qualification Rule (Core Change 3) ──────── */}
      <Card className="p-6 border-brandred-500/30 bg-board-900/90 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brandred-500/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-brandred-400">
                Rule Evaluation
              </span>
              <span className="text-xs text-gray-400">Deterministic Merit & Zone Apportionment</span>
            </div>
            <h2 className="mt-1 text-2xl font-bold text-white">Nationals Qualification Engine</h2>
            <p className="mt-1 text-sm text-gray-300">
              Official Rule: If total team registrations are <strong>under 200</strong>, every registered team advances.
              If total registrations reach <strong>200 or more</strong> (including exactly 200), only <strong>100 teams qualify</strong>,
              distributed across zones based on performance.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant={showSim ? 'secondary' : 'outline'}
              onClick={() => setShowSim(!showSim)}
            >
              {showSim ? '← Back to Live Data' : '🧪 Audit 200+ Teams Simulation'}
            </Button>
          </div>
        </div>

        {/* Rule Status Callout */}
        <div className="mt-5 rounded-xl border border-white/10 bg-board-950/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-gray-400">Rule Applied:</span>
                <span className="font-mono text-sm font-bold text-brandred-400">
                  {activeResult.ruleApplied}
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white">
                  {activeResult.is200OrMore ? 'Threshold ≥ 200 Met' : 'Under 200 Teams'}
                </span>
              </div>
              <p className="text-sm font-medium text-white">{activeResult.ruleTitle}</p>
              <p className="text-xs text-gray-400">{activeResult.ruleDescription}</p>
            </div>

            <div className="flex items-center gap-6 border-t border-white/10 pt-3 sm:border-t-0 sm:pt-0">
              <div className="text-center">
                <span className="block text-xs uppercase tracking-wider text-gray-400">Registrations</span>
                <span className="font-mono text-2xl font-bold text-white">{activeResult.totalRegistrations}</span>
              </div>
              <div className="text-center">
                <span className="block text-xs uppercase tracking-wider text-gray-400">Qualifying Places</span>
                <span className="font-mono text-2xl font-bold text-emerald-400">{activeResult.actualQualifyingCount}</span>
              </div>
            </div>
          </div>
        </div>

        {showSim && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            ⚠️ <strong>Viewing Simulation Mode:</strong> Evaluating 220 simulated teams across all 6 geopolitical zones.
            Notice how the 100 places are distributed across zones based on aggregate zone performance points via Hamilton-Hare largest remainder method.
          </div>
        )}

        {/* Zone Apportionment Breakdown Table */}
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-300">
            Zone Apportionment & Performance Breakdown
          </h3>
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-board-950/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-board-900/80 text-xs font-semibold uppercase text-gray-400">
                <tr>
                  <th className="px-4 py-3">Geopolitical Zone</th>
                  <th className="px-4 py-3 text-center">Registered Teams</th>
                  <th className="px-4 py-3 text-center">Performance Points</th>
                  <th className="px-4 py-3 text-center">Base Quota</th>
                  <th className="px-4 py-3 text-center">Merit Quota</th>
                  <th className="px-4 py-3 text-center">Nationals Places</th>
                  <th className="px-4 py-3">Advance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-xs text-gray-200">
                {activeResult.zoneBreakdown.map((z) => (
                  <tr key={z.zone} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-sans font-semibold text-white">{z.zone}</td>
                    <td className="px-4 py-3 text-center">{z.teamsRegistered}</td>
                    <td className="px-4 py-3 text-center font-bold text-brandred-400">{fmtScore(z.performanceScore)}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{z.baseSpots}</td>
                    <td className="px-4 py-3 text-center text-gray-400">+{z.meritSpots}</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-400">{z.allocatedSpots}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        Top {z.allocatedSpots} of {z.teamsRegistered} qualify
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-white/10 bg-board-900/60 font-mono text-xs font-bold text-white">
                <tr>
                  <td className="px-4 py-3 font-sans">Total Nationals Allocation</td>
                  <td className="px-4 py-3 text-center">{activeResult.totalRegistrations}</td>
                  <td className="px-4 py-3 text-center text-brandred-400">
                    {fmtScore(activeResult.zoneBreakdown.reduce((s, z) => s + z.performanceScore, 0))}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">
                    {activeResult.zoneBreakdown.reduce((s, z) => s + z.baseSpots, 0)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">
                    +{activeResult.zoneBreakdown.reduce((s, z) => s + z.meritSpots, 0)}
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-400 text-sm">
                    {activeResult.actualQualifyingCount}
                  </td>
                  <td className="px-4 py-3 font-sans text-xs text-gray-400">
                    {activeResult.is200OrMore ? 'Capped at 100 teams' : '100% Advancing'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Action button */}
        {!showSim && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <p className="text-xs text-gray-400">
              Applying qualification updates team statuses and creates a permanent entry in the <strong>Audit Log</strong>.
            </p>
            <Button
              variant="danger"
              onClick={handleApplyNationals}
              disabled={applying || !teams.length}
            >
              <Flag className="h-4 w-4" /> {applying ? 'Applying…' : 'Apply & Record Qualification in Audit Log'}
            </Button>
          </div>
        )}

        {applySuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-400">
            <Check className="h-4 w-4 shrink-0" /> {applySuccess}
          </div>
        )}
      </Card>

      {/* ── Section: Settings & Standings ─────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-medium text-white">Competition Settings</h3>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-gray-400">Competition name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-white outline-none focus:border-brandred-500"
            />
          </label>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-gray-400">Winners that advance per zone (Round-robin baseline)</span>
            <input
              type="number"
              min="1"
              value={winnersPerZone}
              onChange={(e) => setWinnersPerZone(e.target.value)}
              className="w-32 rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-white outline-none focus:border-brandred-500"
            />
          </label>
          <Button className="mt-5" onClick={saveConfig}><Save className="h-4 w-4" /> Save settings</Button>
        </Card>

        <Card className="p-6">
          <h3 className="font-medium text-white">Current Standings & Eliminations</h3>
          <p className="mt-2 text-sm text-gray-400">
            Teams currently active: <strong className="text-white">{teams.filter((t) => t.status !== 'eliminated').length}</strong>.
            {eliminated.length > 0 && ` (${eliminated.length} eliminated so far).`}
          </p>
          <div className="mt-4 space-y-2 max-h-56 overflow-y-auto">
            {leaderboard.slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-board-900/60 px-3 py-1.5 text-xs">
                <span className="text-gray-200">#{r.rank} {r.name} ({r.zone})</span>
                <span className="font-mono text-brandred-400">{fmtScore(r.total)} pts</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
