import { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Check, X, AlertCircle, Phone, Mail, Award, Shield } from 'lucide-react';
import { Card, Button, StatusPill, TeamMark } from './ui.jsx';
import { updateTeam, createPlayer, updatePlayer, deletePlayer, createAuditLog } from '../lib/api.js';
import { fmtScore } from '../lib/format.js';
import { STATES, zoneOfTeam } from '../lib/zones.js';

/**
 * TeamEditorModal provides complete team editing:
 *  - Renaming team, editing state & logo
 *  - Adding new team members with validation (no empty names, valid email, duplicate rejection)
 *  - Editing each member (displayName, email, phone, individualScore/rating, isCaptain)
 *  - Deleting members with confirmation
 *  - Records changes via AuditLog if edited by an admin
 */
export default function TeamEditorModal({ team, players, onClose, isAdmin = false, currentUser = null }) {
  // Team details state
  const [teamName, setTeamName] = useState(team.name || '');
  const [teamState, setTeamState] = useState(team.state || '');
  const [teamStatus, setTeamStatus] = useState(team.status || 'active');
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamSuccess, setTeamSuccess] = useState('');

  // Roster state
  const roster = useMemo(() => {
    return players
      .filter((p) => p.teamId === team.id)
      .sort((a, b) => (b.individualScore ?? 0) - (a.individualScore ?? 0));
  }, [players, team.id]);

  // Add player form state
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [newPlayerScore, setNewPlayerScore] = useState(0);
  const [newPlayerCaptain, setNewPlayerCaptain] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addError, setAddError] = useState('');

  // Editing player state
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editPlayerForm, setEditPlayerForm] = useState({ displayName: '', email: '', phone: '', individualScore: 0, isCaptain: false });
  const [editError, setEditError] = useState('');
  const [savingPlayer, setSavingPlayer] = useState(false);

  // General feedback
  const [actionError, setActionError] = useState('');

  const recordAudit = async (action, targetType, targetId, targetName, details) => {
    if (isAdmin && currentUser) {
      await createAuditLog({
        adminEmail: currentUser.email,
        adminName: currentUser.displayName || currentUser.email,
        action,
        targetType,
        targetId,
        targetName,
        details,
      });
    }
  };

  // ── Team update ───────────────────────────────────────────────────────────
  const handleSaveTeam = async (e) => {
    e.preventDefault();
    setTeamError('');
    setTeamSuccess('');
    const trimmed = teamName.trim();
    if (!trimmed) {
      setTeamError('Team name cannot be empty.');
      return;
    }

    setSavingTeam(true);
    try {
      const patch = { name: trimmed, state: teamState };
      if (isAdmin) patch.status = teamStatus;
      await updateTeam(team.id, patch);

      const changeLog = [];
      if (trimmed !== team.name) changeLog.push(`renamed team from "${team.name}" to "${trimmed}"`);
      if (teamState !== team.state) changeLog.push(`changed state from "${team.state || 'none'}" to "${teamState}"`);
      if (isAdmin && teamStatus !== team.status) changeLog.push(`changed status from "${team.status}" to "${teamStatus}"`);

      if (changeLog.length) {
        await recordAudit('UPDATE_TEAM', 'team', team.id, trimmed, changeLog.join(', '));
      }

      setTeamSuccess('Team details saved.');
      setTimeout(() => setTeamSuccess(''), 3000);
    } catch (err) {
      setTeamError(err.message || 'Failed to update team.');
    } finally {
      setSavingTeam(false);
    }
  };

  // ── Add player ────────────────────────────────────────────────────────────
  const handleAddPlayer = async (e) => {
    e.preventDefault();
    setAddError('');
    setActionError('');

    const name = newPlayerName.trim();
    const email = newPlayerEmail.trim().toLowerCase();
    const phone = newPlayerPhone.trim();
    const score = parseFloat(newPlayerScore) || 0;

    // Validation
    if (roster.length >= 5) {
      setAddError('Cannot add member: Teams cannot exceed a maximum of 5 members (excluding the coach).');
      return;
    }
    if (!name) {
      setAddError('Player full name is required.');
      return;
    }
    if (!email) {
      setAddError('Player email address is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAddError('Please enter a valid email address.');
      return;
    }

    // Duplicate check on team
    const nameDuplicate = roster.some((p) => p.displayName.trim().toLowerCase() === name.toLowerCase());
    if (nameDuplicate) {
      setAddError(`A member named "${name}" already exists on this team.`);
      return;
    }
    const emailDuplicate = roster.some((p) => p.email.trim().toLowerCase() === email);
    if (emailDuplicate) {
      setAddError(`A member with email "${email}" is already registered on this team.`);
      return;
    }

    setAddingPlayer(true);
    try {
      const created = await createPlayer({
        teamId: team.id,
        displayName: name,
        email,
        phone,
        individualScore: score,
        isCaptain: newPlayerCaptain,
      });

      await recordAudit(
        'ADD_PLAYER',
        'player',
        created?.id || 'new',
        name,
        `Added player "${name}" (${email}${phone ? ', phone: ' + phone : ''}, score: ${score}) to team "${team.name}"`
      );

      // Reset form
      setNewPlayerName('');
      setNewPlayerEmail('');
      setNewPlayerPhone('');
      setNewPlayerScore(0);
      setNewPlayerCaptain(false);
    } catch (err) {
      setAddError(err.message || 'Could not add player.');
    } finally {
      setAddingPlayer(false);
    }
  };

  // ── Edit player ───────────────────────────────────────────────────────────
  const startEditingPlayer = (player) => {
    setEditingPlayerId(player.id);
    setEditPlayerForm({
      displayName: player.displayName || '',
      email: player.email || '',
      phone: player.phone || '',
      individualScore: player.individualScore ?? 0,
      isCaptain: !!player.isCaptain,
    });
    setEditError('');
  };

  const cancelEditingPlayer = () => {
    setEditingPlayerId(null);
    setEditPlayerForm({ displayName: '', email: '', phone: '', individualScore: 0, isCaptain: false });
    setEditError('');
  };

  const handleSavePlayer = async (playerId) => {
    setEditError('');
    const name = editPlayerForm.displayName.trim();
    const email = editPlayerForm.email.trim().toLowerCase();
    const phone = editPlayerForm.phone.trim();
    const score = parseFloat(editPlayerForm.individualScore) || 0;

    if (!name) {
      setEditError('Player name cannot be empty.');
      return;
    }
    if (!email) {
      setEditError('Player email cannot be empty.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEditError('Please enter a valid email address.');
      return;
    }

    // Check duplicate against other members
    const otherPlayers = roster.filter((p) => p.id !== playerId);
    if (otherPlayers.some((p) => p.displayName.trim().toLowerCase() === name.toLowerCase())) {
      setEditError(`Another member with name "${name}" already exists on this team.`);
      return;
    }
    if (otherPlayers.some((p) => p.email.trim().toLowerCase() === email)) {
      setEditError(`Another member with email "${email}" already exists on this team.`);
      return;
    }

    setSavingPlayer(true);
    try {
      const orig = roster.find((p) => p.id === playerId);
      const patch = {
        displayName: name,
        email,
        phone,
        individualScore: score,
        isCaptain: editPlayerForm.isCaptain,
      };

      await updatePlayer(playerId, patch);

      const changes = [];
      if (orig?.displayName !== name) changes.push(`name: "${orig?.displayName}" -> "${name}"`);
      if (orig?.email !== email) changes.push(`email: "${orig?.email}" -> "${email}"`);
      if ((orig?.phone || '') !== phone) changes.push(`phone: "${orig?.phone || 'none'}" -> "${phone || 'none'}"`);
      if (orig?.individualScore !== score) changes.push(`rating/score: ${orig?.individualScore} -> ${score}`);
      if (orig?.isCaptain !== editPlayerForm.isCaptain) changes.push(`captain: ${orig?.isCaptain} -> ${editPlayerForm.isCaptain}`);

      if (changes.length) {
        await recordAudit('UPDATE_PLAYER', 'player', playerId, name, `Updated player on team "${team.name}": ${changes.join(', ')}`);
      }

      setEditingPlayerId(null);
    } catch (err) {
      setEditError(err.message || 'Failed to update member.');
    } finally {
      setSavingPlayer(false);
    }
  };

  // ── Delete player ─────────────────────────────────────────────────────────
  const handleDeletePlayer = async (player) => {
    if (roster.length <= 2) {
      setActionError('Cannot remove member: Teams must maintain a minimum of 2 members (excluding the coach).');
      return;
    }
    if (!confirm(`Are you sure you want to remove "${player.displayName}" from ${team.name}?`)) {
      return;
    }
    setActionError('');
    try {
      await deletePlayer(player.id);
      await recordAudit(
        'DELETE_PLAYER',
        'player',
        player.id,
        player.displayName,
        `Removed player "${player.displayName}" (${player.email}) from team "${team.name}"`
      );
    } catch (err) {
      setActionError(err.message || 'Could not delete player.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 sm:p-6 backdrop-blur-sm">
      <Card className="relative my-8 max-h-[90vh] w-full max-w-3xl overflow-y-auto border-white/20 bg-board-950 p-6 shadow-2xl sm:p-8">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <TeamMark name={team.name} logoUrl={team.logoUrl} size={48} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Edit Team: {team.name}</h2>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brandred-500/20 px-2 py-0.5 text-xs font-semibold text-brandred-400">
                  <Shield className="h-3 w-3" /> Admin Override
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Zone: <span className="text-brandred-400">{zoneOfTeam(team)}</span> · Join Code: <span className="font-mono text-white">{team.joinCode}</span>
            </p>
          </div>
        </div>

        {actionError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-brandred-500/10 p-3 text-sm text-brandred-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {actionError}
          </div>
        )}

        {/* ── Section 1: Team Details Form ──────────────────────────────── */}
        <div className="mb-8 rounded-xl border border-white/10 bg-board-900/40 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Team Details</h3>
          <form onSubmit={handleSaveTeam} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">Team Name *</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Royal Knights"
                  required
                  className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brandred-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">State *</label>
                <select
                  value={teamState}
                  onChange={(e) => setTeamState(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-sm text-white outline-none focus:border-brandred-500"
                >
                  <option value="">Select state…</option>
                  {STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {isAdmin && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-300">Competition Status</label>
                <select
                  value={teamStatus}
                  onChange={(e) => setTeamStatus(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-sm text-white outline-none focus:border-brandred-500 sm:w-48"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="advanced">Advanced</option>
                  <option value="eliminated">Eliminated</option>
                </select>
              </div>
            )}

            {teamError && (
              <p className="text-xs text-brandred-400">{teamError}</p>
            )}
            {teamSuccess && (
              <p className="text-xs text-emerald-400">{teamSuccess}</p>
            )}

            <div className="flex justify-end">
              <Button size="sm" as="button" type="submit" disabled={savingTeam}>
                {savingTeam ? 'Saving…' : 'Save team details'}
              </Button>
            </div>
          </form>
        </div>

        {/* ── Section 2: Team Members & Roster ──────────────────────────── */}
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                Team Members ({roster.length}/5)
              </h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                roster.length >= 2 && roster.length <= 5 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brandred-500/20 text-brandred-400'
              }`}>
                Min 2 · Max 5
              </span>
            </div>
            <span className="text-xs text-gray-400">
              Coach: <strong className="text-white">{team.coachName || team.coachEmail || team.coachId || 'Assigned'}</strong> (Counted separately)
            </span>
          </div>

          {editError && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-brandred-500/10 p-2.5 text-xs text-brandred-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {editError}
            </div>
          )}

          <div className="space-y-2">
            {roster.map((p) => {
              const isEditing = editingPlayerId === p.id;
              if (isEditing) {
                return (
                  <div key={p.id} className="rounded-xl border border-brandred-500/40 bg-board-900/90 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-gray-400">Full Name *</label>
                        <input
                          type="text"
                          value={editPlayerForm.displayName}
                          onChange={(e) => setEditPlayerForm((f) => ({ ...f, displayName: e.target.value }))}
                          className="w-full rounded-lg border border-white/10 bg-board-950 px-3 py-1.5 text-sm text-white outline-none focus:border-brandred-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-400">Email Address *</label>
                        <input
                          type="email"
                          value={editPlayerForm.email}
                          onChange={(e) => setEditPlayerForm((f) => ({ ...f, email: e.target.value }))}
                          className="w-full rounded-lg border border-white/10 bg-board-950 px-3 py-1.5 text-sm text-white outline-none focus:border-brandred-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-400">Contact / Phone Number</label>
                        <input
                          type="tel"
                          value={editPlayerForm.phone}
                          onChange={(e) => setEditPlayerForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="+234..."
                          className="w-full rounded-lg border border-white/10 bg-board-950 px-3 py-1.5 text-sm text-white outline-none focus:border-brandred-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-400">Score / Rating Points</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={editPlayerForm.individualScore}
                          onChange={(e) => setEditPlayerForm((f) => ({ ...f, individualScore: e.target.value }))}
                          className="w-full rounded-lg border border-white/10 bg-board-950 px-3 py-1.5 text-sm font-mono text-white outline-none focus:border-brandred-500"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                      <label className="flex items-center gap-2 text-xs text-gray-300">
                        <input
                          type="checkbox"
                          checked={editPlayerForm.isCaptain}
                          onChange={(e) => setEditPlayerForm((f) => ({ ...f, isCaptain: e.target.checked }))}
                          className="rounded border-white/10 bg-board-950 text-brandred-500"
                        />
                        Designate as Team Captain
                      </label>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={cancelEditingPlayer} disabled={savingPlayer}>
                          <X className="h-3.5 w-3.5" /> Cancel
                        </Button>
                        <Button size="sm" variant="success" onClick={() => handleSavePlayer(p.id)} disabled={savingPlayer}>
                          <Check className="h-3.5 w-3.5" /> {savingPlayer ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-board-900/50 px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-medium text-white">
                        {p.displayName}
                        {p.isCaptain && (
                          <span className="rounded bg-brandred-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brandred-400">
                            Captain
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {p.email}</span>
                        {p.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {p.phone}</span>}
                        <span className="flex items-center gap-1"><Award className="h-3 w-3 text-brandred-400" /> Score: <span className="font-mono text-white">{fmtScore(p.individualScore ?? 0)}</span></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditingPlayer(p)}
                      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                      title="Edit member details"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePlayer(p)}
                      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-brandred-500/20 hover:text-brandred-400"
                      title="Delete member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {!roster.length && (
              <p className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-gray-500">
                No players on this team yet. Add players below.
              </p>
            )}
          </div>
        </div>

        {/* ── Section 3: Add Member Form ────────────────────────────────── */}
        <div className="rounded-xl border border-white/10 bg-board-900/40 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Add New Member
          </h3>
          <form onSubmit={handleAddPlayer} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Full Name *</label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="e.g. Tunde Bello"
                  required
                  className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brandred-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Email Address *</label>
                <input
                  type="email"
                  value={newPlayerEmail}
                  onChange={(e) => setNewPlayerEmail(e.target.value)}
                  placeholder="e.g. tunde@example.com"
                  required
                  className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brandred-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Phone / Contact Details (optional)</label>
                <input
                  type="tel"
                  value={newPlayerPhone}
                  onChange={(e) => setNewPlayerPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brandred-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Initial Rating / Individual Score</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={newPlayerScore}
                  onChange={(e) => setNewPlayerScore(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-sm font-mono text-white outline-none focus:border-brandred-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={newPlayerCaptain}
                  onChange={(e) => setNewPlayerCaptain(e.target.checked)}
                  className="rounded border-white/10 bg-board-950 text-brandred-500"
                />
                Mark as Captain
              </label>

              <Button size="sm" as="button" type="submit" disabled={addingPlayer || roster.length >= 5}>
                <Plus className="h-3.5 w-3.5" /> {addingPlayer ? 'Adding…' : roster.length >= 5 ? 'Team Full (5/5)' : 'Add member'}
              </Button>
            </div>

            {roster.length >= 5 && (
              <p className="mt-1 text-xs text-amber-400">Team has reached the maximum allowed limit of 5 members.</p>
            )}

            {addError && (
              <p className="mt-1 text-xs text-brandred-400">{addError}</p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-white/10 pt-4">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </Card>
    </div>
  );
}
