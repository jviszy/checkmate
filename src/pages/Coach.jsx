import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Users, Hash, TrendingUp, Play, Star, Trophy, Edit2, Sparkles, AlertCircle, Trash2,
} from 'lucide-react';
import { Card, Button, StatusPill, TeamMark } from '../components/ui.jsx';
import TeamEditorModal from '../components/TeamEditorModal.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import { useAuth } from '../context/AuthContext.jsx';
import { createTeam, createPlayer } from '../lib/api.js';
import { fmtScore, teamById } from '../lib/format.js';
import { STATES, zoneOfState, zoneOfTeam } from '../lib/zones.js';

export default function Coach() {
  const { user } = useAuth();
  const { teams, players, games, leaderboard } = useCheckmate();
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [member1Name, setMember1Name] = useState('');
  const [member1Email, setMember1Email] = useState('');
  const [member2Name, setMember2Name] = useState('');
  const [member2Email, setMember2Email] = useState('');
  const [extraMembers, setExtraMembers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  const myTeams = teams.filter((t) => t.coachId === user?.coachId);

  const totalMemberCount = 2 + extraMembers.length;

  const handleAddExtra = () => {
    if (totalMemberCount >= 5) {
      setFormError('Teams cannot exceed a maximum of 5 members (excluding the coach).');
      return;
    }
    setFormError('');
    setExtraMembers([...extraMembers, { name: '', email: '' }]);
  };

  const handleRemoveExtra = (idx) => {
    setFormError('');
    setExtraMembers(extraMembers.filter((_, i) => i !== idx));
  };

  const handleUpdateExtra = (idx, field, val) => {
    const updated = [...extraMembers];
    updated[idx][field] = val;
    setExtraMembers(updated);
  };

  const addTeam = async (e) => {
    e.preventDefault();
    setFormError('');

    // Front-end validation
    if (!name.trim()) { setFormError('Please enter a team name.'); return; }
    if (!state) { setFormError('Please select the team\'s state.'); return; }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!member1Name.trim() || !member1Email.trim()) {
      setFormError('Member 1 (Captain) name and valid email are required.');
      return;
    }
    if (!emailRegex.test(member1Email.trim())) {
      setFormError('Please enter a valid email for Member 1.');
      return;
    }

    if (!member2Name.trim() || !member2Email.trim()) {
      setFormError('Teams must have a minimum of 2 members (excluding the coach). Please fill Member 2 details.');
      return;
    }
    if (!emailRegex.test(member2Email.trim())) {
      setFormError('Please enter a valid email for Member 2.');
      return;
    }

    const validExtras = [];
    for (let i = 0; i < extraMembers.length; i++) {
      const em = extraMembers[i];
      if (!em.name.trim() || !em.email.trim()) {
        setFormError(`Please provide name and email for Member ${i + 3}, or remove it.`);
        return;
      }
      if (!emailRegex.test(em.email.trim())) {
        setFormError(`Please enter a valid email for Member ${i + 3}.`);
        return;
      }
      validExtras.push({ displayName: em.name.trim(), email: em.email.trim().toLowerCase() });
    }

    const totalCount = 2 + validExtras.length;
    if (totalCount < 2) {
      setFormError('Teams must have a minimum of 2 members, plus exactly one coach.');
      return;
    }
    if (totalCount > 5) {
      setFormError('Teams cannot exceed a maximum of 5 members, plus exactly one coach.');
      return;
    }

    setBusy(true);
    try {
      const allMembers = [
        { displayName: member1Name.trim(), email: member1Email.trim().toLowerCase(), isCaptain: true },
        { displayName: member2Name.trim(), email: member2Email.trim().toLowerCase(), isCaptain: false },
        ...validExtras,
      ];

      const createdTeam = await createTeam({
        name: name.trim(),
        coachId: user.coachId,
        coachName: user.displayName,
        coachEmail: user.email,
        status: 'active',
        state,
        members: allMembers,
      });

      for (const m of allMembers) {
        await createPlayer({
          teamId: createdTeam.id,
          displayName: m.displayName,
          email: m.email,
          isCaptain: m.isCaptain,
        });
      }

      setName('');
      setState('');
      setMember1Name('');
      setMember1Email('');
      setMember2Name('');
      setMember2Email('');
      setExtraMembers([]);
      setShowAddForm(false);
    } catch (err) {
      setFormError(err.message || 'Failed to create team.');
    } finally {
      setBusy(false);
    }
  };

  const totalPlayers = myTeams.reduce((n, t) => n + players.filter((p) => p.teamId === t.id).length, 0);
  const liveGames = games.filter(
    (g) => g.status === 'live' && myTeams.some((t) => t.id === g.whiteTeamId || t.id === g.blackTeamId)
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Live Match Demo Banner for Coaches */}
      <div className="mb-8 rounded-2xl border border-brandred-500/40 bg-gradient-to-r from-brandred-950/60 via-board-900 to-board-950 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brandred-500/20 p-2.5 text-brandred-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brandred-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brandred-400">
                  Coach Practice Tool
                </span>
                <span className="text-xs text-gray-400">Safe Sandbox</span>
              </div>
              <h3 className="text-sm font-semibold text-white">Live Match Demo on the Portal</h3>
              <p className="text-xs text-gray-300">
                Show your teams how live chessboards, 10-minute clocks, and smart move hints work in a safe, non-competitive setting.
              </p>
            </div>
          </div>
          <Button to="/demo" size="sm" variant="outline" className="shrink-0">
            Launch Match Demo
          </Button>
        </div>
      </div>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Coach dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">
            Welcome, {user?.displayName}. You are registered as coach for your teams.
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4" /> {showAddForm ? 'Cancel' : 'Add new team'}
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={Users} label="Teams" value={myTeams.length} />
        <Stat icon={Hash} label="Players" value={totalPlayers} />
        <Stat icon={Play} label="Live games" value={liveGames.length} accent={liveGames.length > 0} />
        <Stat icon={Trophy} label="Best rank" value={bestRank(myTeams, leaderboard)} />
      </div>

      {/* Create team Form */}
      {showAddForm && (
        <Card className="mb-8 p-6">
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h2 className="text-base font-semibold text-white">Register a new team</h2>
              <p className="text-xs text-gray-400">
                Rule: Exactly 1 coach (you) + 2 to 5 members. Coach is counted separately from members.
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400">
              {totalMemberCount} / 5 members
            </span>
          </div>

          <form onSubmit={addTeam} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">Team Name *</label>
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Royal Knights"
                  required
                  className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-brandred-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">State *</label>
                <select
                  value={state} onChange={(e) => setState(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-white outline-none focus:border-brandred-500"
                >
                  <option value="">Select state…</option>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {state && <span className="mt-1 block text-xs text-brandred-400">Zone: {zoneOfState(state)}</span>}
              </div>
            </div>

            {/* Member 1 (Captain) */}
            <div className="rounded-xl border border-white/10 bg-board-900/50 p-4">
              <span className="text-xs font-semibold text-brandred-400">Member 1 (Team Captain) *</span>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <input
                  value={member1Name} onChange={(e) => setMember1Name(e.target.value)}
                  placeholder="Captain full name" required
                  className="rounded-lg border border-white/10 bg-board-950 px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brandred-500"
                />
                <input
                  type="email" value={member1Email} onChange={(e) => setMember1Email(e.target.value)}
                  placeholder="Captain email" required
                  className="rounded-lg border border-white/10 bg-board-950 px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brandred-500"
                />
              </div>
            </div>

            {/* Member 2 */}
            <div className="rounded-xl border border-white/10 bg-board-900/50 p-4">
              <span className="text-xs font-semibold text-gray-300">Member 2 (Required for 2-member minimum) *</span>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <input
                  value={member2Name} onChange={(e) => setMember2Name(e.target.value)}
                  placeholder="Member 2 full name" required
                  className="rounded-lg border border-white/10 bg-board-950 px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brandred-500"
                />
                <input
                  type="email" value={member2Email} onChange={(e) => setMember2Email(e.target.value)}
                  placeholder="Member 2 email" required
                  className="rounded-lg border border-white/10 bg-board-950 px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brandred-500"
                />
              </div>
            </div>

            {/* Extra Members 3..5 */}
            {extraMembers.map((em, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-board-900/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-300">Member {idx + 3}</span>
                  <button type="button" onClick={() => handleRemoveExtra(idx)} className="text-xs text-brandred-400 hover:text-brandred-300">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <input
                    value={em.name} onChange={(e) => handleUpdateExtra(idx, 'name', e.target.value)}
                    placeholder={`Member ${idx + 3} name`} required
                    className="rounded-lg border border-white/10 bg-board-950 px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brandred-500"
                  />
                  <input
                    type="email" value={em.email} onChange={(e) => handleUpdateExtra(idx, 'email', e.target.value)}
                    placeholder={`Member ${idx + 3} email`} required
                    className="rounded-lg border border-white/10 bg-board-950 px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brandred-500"
                  />
                </div>
              </div>
            ))}

            {totalMemberCount < 5 && (
              <Button type="button" variant="outline" size="sm" onClick={handleAddExtra}>
                <Plus className="h-4 w-4" /> Add another member ({totalMemberCount}/5)
              </Button>
            )}

            {formError && (
              <div className="flex items-center gap-2 rounded-lg bg-brandred-500/10 p-3 text-sm text-brandred-400">
                <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button as="button" type="submit" disabled={busy}>
                {busy ? 'Creating team…' : 'Create team with roster'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Teams list */}
      {myTeams.length === 0 ? (
        <Card className="p-10 text-center text-gray-400">
          You haven't added any teams yet. Click "Add new team" to register your first team.
        </Card>
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
                      <div className="text-xs text-gray-500">{t.state || '—'} · {zoneOfTeam(t)} · Join code <span className="font-mono text-brandred-400">{t.joinCode}</span></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white">
                      Roster: {roster.length}/5 members
                    </span>
                    {row && <span>Zone rank <span className="font-semibold text-white">#{row.zoneRank}</span></span>}
                    <span className="inline-flex items-center gap-1"><TrendingUp className="h-4 w-4 text-brandred-400" /> <span className="font-mono font-bold text-white">{fmtScore(row?.total ?? 0)}</span></span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingTeam(t)}
                      className="ml-1"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit team
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  {/* Roster */}
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Roster ({roster.length}/5) · Coach: {t.coachName || user?.displayName}
                    </h4>
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

      {editingTeam && (
        <TeamEditorModal
          team={editingTeam}
          players={players}
          isAdmin={false}
          currentUser={user}
          onClose={() => setEditingTeam(null)}
        />
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
