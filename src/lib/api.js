// ─────────────────────────────────────────────────────────────────────────
// Data layer — AWS Amplify (AppSync + DynamoDB) edition.
//
// The SINGLE place the UI talks to for data. Every function keeps the same name
// and return shape the UI already expects, so pages/components don't change.
//
// Reads use the public API key (so the landing page, leaderboard and live
// boards work for signed-out visitors). Writes use the signed-in user's Cognito
// session. Cross-device realtime comes from AppSync observeQuery subscriptions,
// surfaced through the same onChange() event the UI already listens to.
// ─────────────────────────────────────────────────────────────────────────

import { client } from './amplify.js';
import outputs from '../../amplify_outputs.json';
import { INITIAL_FEN, SEED_TOURNAMENT, SAMPLE_TEAMS, SAMPLE_PLAYERS, SAMPLE_MATCHES, SAMPLE_GAMES } from './seed.js';
import {
  isRegistrationOpen,
  getRegistrationDeadlineText,
  isEmailExemptTeam,
  makePendingEmailPlaceholder,
  EXEMPT_EMAIL_TEAM,
  ROUND_DURATION_MS,
  COMPETITION_WINDOW,
} from './tournamentConfig.js';
import { sendRegistrationConfirmation } from './notifications.js';

// Public reads go through the API key; signed-in writes use the default (userPool).
const PUB = { authMode: 'apiKey' };

// ── change notification (realtime) ──────────────────────────────────────────
const bus = new EventTarget();
const EVT = 'checkmate:change';
const emit = () => bus.dispatchEvent(new Event(EVT));

let subscribed = false;
function ensureSubscriptions() {
  if (subscribed) return;
  subscribed = true;
  // Live cross-device updates: any change to a public model re-triggers a
  // refresh in the UI. Best-effort — if a subscription can't start, local
  // writes still fire emit() directly, so the acting user always sees results.
  for (const model of ['Team', 'Player', 'Match', 'Game', 'Tournament']) {
    try {
      client.models[model].observeQuery({ authMode: 'apiKey' }).subscribe({
        next: () => emit(),
        error: () => {},
      });
    } catch { /* ignore */ }
  }
}

/** Subscribe to any data change (local write or realtime update from AppSync). */
export function onChange(cb) {
  ensureSubscriptions();
  bus.addEventListener(EVT, cb);
  return () => bus.removeEventListener(EVT, cb);
}

// ── helpers ─────────────────────────────────────────────────────────────────
// The deployed AppSync schema can lag behind the local model definitions
// (amplify_outputs.json is the deployed truth). Sending a field the deployed
// input type does not define makes AppSync reject the WHOLE mutation, which is
// what broke team registration (Team.coachName/coachEmail, Player.phone).
// Writes are therefore filtered down to the deployed field set.
const DEPLOYED_FIELDS = (() => {
  const models = outputs?.data?.model_introspection?.models || {};
  const map = {};
  for (const [name, m] of Object.entries(models)) {
    map[name] = new Set(Object.keys(m.fields || {}));
  }
  return map;
})();

function forModel(modelName, input) {
  const known = DEPLOYED_FIELDS[modelName];
  if (!known || !known.size) return input;
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (known.has(k)) out[k] = v;
  }
  return out;
}

function unwrap(res) {
  if (res?.errors?.length) {
    throw new Error(res.errors.map((e) => e.message).join('; '));
  }
  return res?.data;
}

/** List every record of a model, following pagination. */
async function listAll(model, options = {}) {
  const out = [];
  let nextToken = null;
  do {
    const res = await client.models[model].list({ ...PUB, ...options, nextToken, limit: 1000 });
    if (res?.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '));
    out.push(...(res.data ?? []));
    nextToken = res.nextToken;
  } while (nextToken);
  return out;
}

const after = (v) => { emit(); return v; };

function genJoinCode() {
  return Array.from({ length: 6 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
  ).join('');
}

// ── Tournament (a single row) ───────────────────────────────────────────────
export async function getTournament() {
  const rows = await listAll('Tournament');
  if (rows.length) return rows[0];
  // Not seeded yet — return a safe read-only default so the UI still renders.
  return { ...SEED_TOURNAMENT };
}

export async function updateTournament(patch) {
  const rows = await listAll('Tournament');
  if (!rows.length) {
    const created = unwrap(await client.models.Tournament.create({
      name: SEED_TOURNAMENT.name,
      currentRound: SEED_TOURNAMENT.currentRound,
      winnersPerZone: SEED_TOURNAMENT.winnersPerZone,
      status: SEED_TOURNAMENT.status,
      ...patch,
    }));
    return after(created);
  }
  const updated = unwrap(await client.models.Tournament.update({ id: rows[0].id, ...patch }));
  return after(updated);
}

// ── Team limits & validation rules ──────────────────────────────────────────
export const MIN_TEAM_MEMBERS = 2;
export const MAX_TEAM_MEMBERS = 5;
export const REQUIRED_COACHES = 1;

/**
 * Validates team registration size (2-5 members) and coach requirement (exactly 1 coach).
 * Counts the coach separately from the member count.
 * Throws descriptive error messages if limits are violated.
 */
export function validateTeamLimits({ coach, members, existingCount = 0, teamName = '' }) {
  const hasCoach = !!(
    coach &&
    (coach.id || coach.coachId || coach.name || coach.displayName || coach.email)
  );

  if (!hasCoach) {
    throw new Error('Every team registration requires exactly one coach. The coach is counted separately from the member count.');
  }

  const count = Array.isArray(members) ? members.length : existingCount;
  if (count < MIN_TEAM_MEMBERS) {
    throw new Error(`Teams must have a minimum of ${MIN_TEAM_MEMBERS} members (excluding the coach). Current roster has ${count} member${count === 1 ? '' : 's'}.`);
  }
  if (count > MAX_TEAM_MEMBERS) {
    throw new Error(`Teams cannot exceed a maximum of ${MAX_TEAM_MEMBERS} members (excluding the coach). Current roster has ${count} members.`);
  }

  // Validate player emails unless this is the single exempt team ("The Legend 1")
  if (Array.isArray(members)) {
    const isExempt = isEmailExemptTeam(teamName);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!isExempt) {
        if (!m.email || !emailRegex.test(m.email.trim())) {
          throw new Error(`Member ${i + 1} (${m.displayName || m.name || 'unnamed'}) requires a valid email address.`);
        }
      }
    }
  }

  return true;
}

// ── Teams ───────────────────────────────────────────────────────────────────
export const listTeams = () => listAll('Team');
export async function getTeam(id) {
  return unwrap(await client.models.Team.get({ id }, PUB)) || null;
}
export async function listTeamsByCoach(coachId) {
  return listAll('Team', { filter: { coachId: { eq: coachId } } });
}
export async function getTeamByJoinCode(code) {
  const rows = await listAll('Team', { filter: { joinCode: { eq: String(code).toUpperCase() } } });
  return rows[0] ?? null;
}

export async function createTeam({
  name,
  logoUrl = '',
  coachId = null,
  coachName = '',
  coachEmail = '',
  status = 'active',
  state = '',
  members = null,
}) {
  // Item 4: Registration cutoff check
  if (!isRegistrationOpen()) {
    throw new Error(`Registration closed on ${getRegistrationDeadlineText()}. New registrations are no longer accepted.`);
  }

  // Validate coach requirement on every registration
  if (!coachId && !coachName && !coachEmail) {
    throw new Error('Every team registration requires exactly one coach. The coach is counted separately from the member count.');
  }

  // If initial members list provided, enforce 2 to 5 member boundaries
  if (members !== null && Array.isArray(members)) {
    if (members.length < MIN_TEAM_MEMBERS) {
      throw new Error(`Teams must have a minimum of ${MIN_TEAM_MEMBERS} members (excluding the coach). Provided: ${members.length}.`);
    }
    if (members.length > MAX_TEAM_MEMBERS) {
      throw new Error(`Teams cannot exceed a maximum of ${MAX_TEAM_MEMBERS} members (excluding the coach). Provided: ${members.length}.`);
    }
  }

  let round = 1;
  try { round = (await getTournament())?.currentRound ?? 1; } catch { /* default */ }
  const team = unwrap(await client.models.Team.create(forModel('Team', {
    name,
    logoUrl,
    status,
    coachId: coachId || `coach_${Math.random().toString(36).slice(2, 8)}`,
    coachName: coachName || undefined,
    coachEmail: coachEmail || undefined,
    state,
    round,
    joinCode: genJoinCode(),
  })));
  return after(team);
}

export async function createTeamWithRoster({ teamName, state, logoUrl = '', coach, members = [] }) {
  // Item 4: Registration cutoff check
  if (!isRegistrationOpen()) {
    throw new Error(`Registration closed on ${getRegistrationDeadlineText()}. New registrations are no longer accepted.`);
  }

  validateTeamLimits({ coach, members, teamName });
  const isExempt = isEmailExemptTeam(teamName);

  const team = await createTeam({
    name: teamName,
    state,
    logoUrl,
    coachId: coach.coachId || coach.id || `coach_${Math.random().toString(36).slice(2, 8)}`,
    coachName: coach.name || coach.displayName || '',
    coachEmail: coach.email || '',
    status: 'active',
    members,
  });

  const createdPlayers = [];
  for (const m of members) {
    let email = (m.email || '').trim().toLowerCase();
    // Item 5: Exactly one team ("The Legend 1") may register without email; store clearly marked placeholder
    if (!email && isExempt) {
      email = makePendingEmailPlaceholder(m.displayName || m.name, teamName);
    }
    const player = await createPlayer({
      teamId: team.id,
      displayName: m.displayName || m.name,
      email,
      phone: m.phone || '',
      isCaptain: !!m.isCaptain,
      individualScore: m.individualScore || 0,
    });
    createdPlayers.push(player);
  }

  // Item 7: Send confirmation notification to team's registration email (coach email)
  const confirmationEmail = coach.email || (isExempt ? null : members[0]?.email);
  if (confirmationEmail) {
    sendRegistrationConfirmation({
      to: confirmationEmail,
      teamName: team.name,
      coachName: coach.name || coach.displayName,
      captainName: createdPlayers.find((p) => p.isCaptain)?.displayName || createdPlayers[0]?.displayName,
      joinCode: team.joinCode,
      members: createdPlayers,
    }).catch((err) => console.warn('Failed to send confirmation email', err));
  }

  return { team, coach, players: createdPlayers };
}

// Item 1: Restricted to admin role
export async function updateTeam(id, patch, currentUser = null) {
  if (currentUser && currentUser.role !== 'admin') {
    throw new Error('Only administrators can edit team details.');
  }
  return after(unwrap(await client.models.Team.update({ id, ...forModel('Team', patch) })));
}

// Item 1: Restricted to admin role; removes team, members, related matches, and games
export async function deleteTeam(id, currentUser = null) {
  if (currentUser && currentUser.role !== 'admin') {
    throw new Error('Only administrators can delete teams.');
  }

  const [players, allMatches, allGames] = await Promise.all([
    listAll('Player', { filter: { teamId: { eq: id } } }),
    listAll('Match'),
    listAll('Game'),
  ]);

  const targetMatches = allMatches.filter((m) => m.teamAId === id || m.teamBId === id);
  const targetMatchIds = new Set(targetMatches.map((m) => m.id));
  const playerIds = new Set(players.map((p) => p.id));

  const targetGames = allGames.filter((g) => (
    g.whiteTeamId === id ||
    g.blackTeamId === id ||
    targetMatchIds.has(g.matchId) ||
    playerIds.has(g.whitePlayerId) ||
    playerIds.has(g.blackPlayerId)
  ));

  await Promise.all([
    ...players.map((p) => client.models.Player.delete({ id: p.id })),
    ...targetMatches.map((m) => client.models.Match.delete({ id: m.id })),
    ...targetGames.map((g) => client.models.Game.delete({ id: g.id })),
  ]);
  // Best effort: remove user profiles tied to this team so those emails can
  // register again without stale role/team links.
  try {
    const profiles = await listAll('UserProfile', { authMode: 'userPool', filter: { teamId: { eq: id } } });
    await Promise.all(profiles.map((u) => client.models.UserProfile.delete({ id: u.id }).catch(() => {})));
  } catch { /* ignore */ }
  await client.models.Team.delete({ id });
  return after(true);
}

export const approveTeam = (id, user) => updateTeam(id, { status: 'active' }, user);
export const rejectTeam = (id, user) => deleteTeam(id, user);

// ── Players ──────────────────────────────────────────────────────────────---
export const listPlayers = () => listAll('Player');
export async function listPlayersByTeam(teamId) {
  return listAll('Player', { filter: { teamId: { eq: teamId } } });
}
export async function getPlayer(id) {
  return unwrap(await client.models.Player.get({ id }, PUB)) || null;
}

export async function createPlayer({ teamId, displayName, email, phone = '', isCaptain = false, individualScore = 0 }) {
  if (teamId) {
    const existing = await listPlayersByTeam(teamId);
    if (existing.length >= MAX_TEAM_MEMBERS) {
      throw new Error(`Cannot add member: Team already has the maximum allowed limit of ${MAX_TEAM_MEMBERS} members (excluding the coach).`);
    }
  }
  const player = unwrap(await client.models.Player.create(forModel('Player', {
    teamId, displayName, email, ...(phone ? { phone } : {}), isCaptain, individualScore,
  })));
  return after(player);
}

export async function updatePlayer(id, patch) {
  return after(unwrap(await client.models.Player.update({ id, ...forModel('Player', patch) })));
}

export async function deletePlayer(id) {
  // Members can always be removed, even when it takes the roster below the
  // 2-member minimum: the minimum is enforced on new registrations and by the
  // item 6 reconciliation (undersized teams are deleted there). A hard block
  // here left coaches unable to clean up a half-registered duplicate team.
  // Clean up any scheduled games involving this player.
  const games = await listAll('Game', {
    filter: { or: [{ whitePlayerId: { eq: id } }, { blackPlayerId: { eq: id } }] }
  });
  await Promise.all(games.filter((g) => g.status === 'scheduled').map((g) => client.models.Game.delete({ id: g.id })));
  // Best effort: remove the user profile linked to this player, so the person
  // can register again cleanly. May be denied when run by a non-admin (profiles
  // are owner/Admins scoped) — ignore failures.
  try {
    const profiles = await listAll('UserProfile', { authMode: 'userPool', filter: { playerId: { eq: id } } });
    await Promise.all(profiles.map((u) => client.models.UserProfile.delete({ id: u.id }).catch(() => {})));
  } catch { /* non-admin callers cannot see/delete other profiles */ }
  await client.models.Player.delete({ id });
  return after(true);
}

/**
 * Cuts any team that has more than 5 members down to only 5 members.
 * Preserves captains first, followed by members with the highest individual scores.
 * Permanently removes excess members from the database.
 */
export async function trimOversizedTeams() {
  const allPlayers = await listPlayers();
  const byTeam = {};
  for (const p of allPlayers) {
    if (p.teamId) {
      (byTeam[p.teamId] ||= []).push(p);
    }
  }

  let totalTrimmed = 0;
  const details = [];

  for (const [teamId, teamPlayers] of Object.entries(byTeam)) {
    if (teamPlayers.length > MAX_TEAM_MEMBERS) {
      // Prioritize captains, then highest individual score
      const sorted = [...teamPlayers].sort((a, b) => {
        if (a.isCaptain && !b.isCaptain) return -1;
        if (!a.isCaptain && b.isCaptain) return 1;
        return (
          (Number(b.individualScore) || 0) - (Number(a.individualScore) || 0) ||
          String(a.displayName || '').localeCompare(String(b.displayName || '')) ||
          String(a.id).localeCompare(String(b.id))
        );
      });

      const toKeep = sorted.slice(0, MAX_TEAM_MEMBERS);
      const toRemove = sorted.slice(MAX_TEAM_MEMBERS);

      for (const p of toRemove) {
        try {
          const games = await listAll('Game', {
            filter: { or: [{ whitePlayerId: { eq: p.id } }, { blackPlayerId: { eq: p.id } }] }
          });
          await Promise.all(games.filter((g) => g.status === 'scheduled').map((g) => client.models.Game.delete({ id: g.id })));
          await client.models.Player.delete({ id: p.id });
          totalTrimmed++;
        } catch (err) {
          console.warn('Failed to delete excess player:', p.id, err);
        }
      }

      details.push({
        teamId,
        kept: toKeep.map((p) => p.displayName),
        removed: toRemove.map((p) => p.displayName),
      });
    }
  }

  if (totalTrimmed > 0) {
    emit();
  }

  return { totalTrimmed, details };
}

/**
 * Item 6: Enforce team size between 2 and 5 players.
 * Teams with more than 5 players have extra members removed.
 * Teams with fewer than 2 players are deleted.
 * Runs as a one-time reconciliation over existing data and logs every removal and deletion.
 */
export async function reconcileTeamSizes(currentUser = null) {
  const [allTeams, allPlayers] = await Promise.all([
    listTeams(),
    listPlayers(),
  ]);

  const playersByTeam = new Map();
  for (const t of allTeams) {
    playersByTeam.set(t.id, []);
  }
  for (const p of allPlayers) {
    if (p.teamId && playersByTeam.has(p.teamId)) {
      playersByTeam.get(p.teamId).push(p);
    }
  }

  const deletedTeams = [];
  const trimmedPlayers = [];

  // Normalize "The Legend 1" roster names to the canonical capitalization
  // (e.g. "Sophia samson" -> "Sophia Samson", "jadesola Jasmine Oguniyi" ->
  // "Jadesola Jasmine Oguniyi").
  const legendTeam = allTeams.find((t) => isEmailExemptTeam(t.name));
  if (legendTeam) {
    const canonical = EXEMPT_EMAIL_TEAM.players.map((p) => p.displayName);
    const roster = playersByTeam.get(legendTeam.id) || [];
    for (const p of roster) {
      const match = canonical.find((n) => n.toLowerCase() === String(p.displayName || '').trim().toLowerCase());
      if (match && match !== p.displayName) {
        await updatePlayer(p.id, { displayName: match });
      }
    }
  }

  for (const team of allTeams) {
    const roster = playersByTeam.get(team.id) || [];

    // Teams with fewer than 2 players are deleted
    if (roster.length < MIN_TEAM_MEMBERS) {
      await deleteTeam(team.id, currentUser ? { role: 'admin' } : null);
      deletedTeams.push({ teamId: team.id, teamName: team.name, count: roster.length });

      await createAuditLog({
        adminEmail: currentUser?.email || 'admin@coderina.org',
        adminName: currentUser?.displayName || 'System Admin',
        action: 'RECONCILIATION_DELETE_TEAM',
        targetType: 'team',
        targetId: team.id,
        targetName: team.name,
        details: `Deleted team "${team.name}" during size reconciliation because it had ${roster.length} member(s) (minimum ${MIN_TEAM_MEMBERS} required).`,
      });
      continue;
    }

    // Teams with more than 5 players have excess members removed
    if (roster.length > MAX_TEAM_MEMBERS) {
      // Prioritize captains, then highest individual score
      const sorted = [...roster].sort((a, b) => {
        if (a.isCaptain && !b.isCaptain) return -1;
        if (!a.isCaptain && b.isCaptain) return 1;
        return (
          (Number(b.individualScore) || 0) - (Number(a.individualScore) || 0) ||
          String(a.displayName || '').localeCompare(String(b.displayName || '')) ||
          String(a.id).localeCompare(String(b.id))
        );
      });

      const toRemove = sorted.slice(MAX_TEAM_MEMBERS);
      for (const p of toRemove) {
        // Clean up any scheduled games involving this player
        const games = await listAll('Game', {
          filter: { or: [{ whitePlayerId: { eq: p.id } }, { blackPlayerId: { eq: p.id } }] }
        });
        await Promise.all(games.filter((g) => g.status === 'scheduled').map((g) => client.models.Game.delete({ id: g.id })));
        await client.models.Player.delete({ id: p.id });

        trimmedPlayers.push({ playerId: p.id, displayName: p.displayName, teamId: team.id, teamName: team.name });

        await createAuditLog({
          adminEmail: currentUser?.email || 'admin@coderina.org',
          adminName: currentUser?.displayName || 'System Admin',
          action: 'RECONCILIATION_TRIM_PLAYER',
          targetType: 'player',
          targetId: p.id,
          targetName: p.displayName,
          details: `Removed excess player "${p.displayName}" from team "${team.name}" during size reconciliation (exceeded ${MAX_TEAM_MEMBERS} maximum).`,
        });
      }
    }
  }

  emit();
  return { deletedTeams, trimmedPlayers };
}

// ── Audit Logs (Admin changes) ──────────────────────────────────────────────
export async function listAuditLogs() {
  if (!client?.models?.AuditLog) {
    const raw = localStorage.getItem('checkmate_audit_logs');
    return raw ? JSON.parse(raw) : [];
  }
  try {
    const logs = await listAll('AuditLog');
    return logs.sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
  } catch {
    const raw = localStorage.getItem('checkmate_audit_logs');
    return raw ? JSON.parse(raw) : [];
  }
}

export async function createAuditLog({ adminEmail, adminName = '', action, targetType, targetId, targetName = '', details = '' }) {
  const timestamp = new Date().toISOString();
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    adminEmail,
    adminName,
    action,
    targetType,
    targetId,
    targetName,
    details,
    timestamp,
  };
  try {
    if (client?.models?.AuditLog) {
      await client.models.AuditLog.create(entry);
    }
  } catch (err) {
    console.warn('Failed to save audit log to backend, falling back to local storage', err);
  }
  try {
    const raw = localStorage.getItem('checkmate_audit_logs');
    const existing = raw ? JSON.parse(raw) : [];
    localStorage.setItem('checkmate_audit_logs', JSON.stringify([entry, ...existing].slice(0, 100)));
  } catch { /* ignore */ }
  return after(entry);
}

// ── Matches (team fixtures) ─────────────────────────────────────────────────
export const listMatches = () => listAll('Match');

/**
 * Item 8: Give admins a view of all matches played.
 * Give coaches a view limited to matches involving their own players.
 * Enforce these permissions on the server/API layer.
 */
export async function listMatchesForUser(user) {
  const matches = await listMatches();
  if (!user || user.role === 'admin') {
    return matches;
  }
  if (user.role === 'coach') {
    const coachId = user.coachId;
    const myTeams = coachId ? await listTeamsByCoach(coachId) : [];
    const myTeamIds = new Set(myTeams.map((t) => t.id));
    return matches.filter((m) => myTeamIds.has(m.teamAId) || myTeamIds.has(m.teamBId));
  }
  if (user.teamId) {
    return matches.filter((m) => m.teamAId === user.teamId || m.teamBId === user.teamId);
  }
  return matches;
}

export async function createMatches(records) {
  const created = [];
  for (const r of records) {
    created.push(unwrap(await client.models.Match.create({ scoreA: 0, scoreB: 0, ...r })));
  }
  return after(created);
}

export async function updateMatch(id, patch) {
  return after(unwrap(await client.models.Match.update({ id, ...patch })));
}

export async function deleteMatchesForRound(round) {
  const [matches, allMatches, games] = await Promise.all([
    listAll('Match', { filter: { round: { eq: round } } }),
    listAll('Match'),
    listAll('Game', { filter: { round: { eq: round } } }),
  ]);
  const ids = new Set(matches.map((m) => m.id));
  const allIds = new Set(allMatches.map((m) => m.id));
  // Delete this round's matches, plus this round's games that belong to them
  // OR are orphaned (their match was deleted earlier) — otherwise orphans
  // accumulate across regenerations and players end up with duplicate boards.
  const doomedGames = games.filter((g) => !g.matchId || ids.has(g.matchId) || !allIds.has(g.matchId));
  await Promise.all([
    ...matches.map((m) => client.models.Match.delete({ id: m.id })),
    ...doomedGames.map((g) => client.models.Game.delete({ id: g.id })),
  ]);
  return after(true);
}

// ── Games (playable chess boards — the scored unit) ─────────────────────────
export const listGames = () => listAll('Game');

/**
 * Item 8: Server-enforced game listing for admin vs coach.
 */
export async function listGamesForUser(user) {
  const games = await listGames();
  if (!user || user.role === 'admin') {
    return games;
  }
  if (user.role === 'coach') {
    const coachId = user.coachId;
    const myTeams = coachId ? await listTeamsByCoach(coachId) : [];
    const myTeamIds = new Set(myTeams.map((t) => t.id));
    return games.filter((g) => myTeamIds.has(g.whiteTeamId) || myTeamIds.has(g.blackTeamId));
  }
  if (user.playerId) {
    return games.filter((g) => g.whitePlayerId === user.playerId || g.blackPlayerId === user.playerId);
  }
  return games;
}

export async function getGame(id) {
  return unwrap(await client.models.Game.get({ id }, PUB)) || null;
}

// Default time control: one round duration (10 minutes, from tournamentConfig)
// with a 3-second increment per move.
export const DEFAULT_CLOCK_MS = ROUND_DURATION_MS;
export const DEFAULT_INCREMENT_MS = 3 * 1000;

export async function createGame({
  matchId = null, round = 1, whiteTeamId, whitePlayerId, blackTeamId, blackPlayerId,
  clockMs = DEFAULT_CLOCK_MS, incrementMs = DEFAULT_INCREMENT_MS,
}) {
  const game = unwrap(await client.models.Game.create({
    matchId, round, whiteTeamId, whitePlayerId, blackTeamId, blackPlayerId,
    fen: INITIAL_FEN, pgn: '', status: 'scheduled',
    result: null, winnerTeamId: null,
    clockMs, incrementMs, whiteMs: clockMs, blackMs: clockMs, lastMoveAt: null,
    startedAt: null, endedAt: null,
  }));
  return after(game);
}

/** Persist a move (fen + pgn + clocks). Flips a scheduled game to live. */
export async function updateGame(id, { fen, pgn, status, whiteMs, blackMs, lastMoveAt }) {
  const g = await getGame(id);
  if (!g) return null;
  const patch = { id, fen, pgn };
  if (whiteMs !== undefined) patch.whiteMs = whiteMs;
  if (blackMs !== undefined) patch.blackMs = blackMs;
  if (lastMoveAt !== undefined) patch.lastMoveAt = lastMoveAt;
  if (status) patch.status = status;
  else if (g.status === 'scheduled') patch.status = 'live';
  if (patch.status === 'live' && !g.startedAt) patch.startedAt = new Date().toISOString();
  return after(unwrap(await client.models.Game.update(patch)));
}

/**
 * Finish a game. result: 'white' | 'black' | 'draw'.
 * Awards points to the players (win 1, draw 0.5) — which roll up into the team
 * total and the scoreboard automatically — then recomputes the parent match.
 */
export async function completeGame(id, result, { fen, pgn } = {}) {
  const game = await getGame(id);
  if (!game || game.status === 'completed') return game || null;

  const winnerTeamId = result === 'white' ? game.whiteTeamId : result === 'black' ? game.blackTeamId : null;

  const award = async (playerId, pts) => {
    if (!playerId || !pts) return;
    const p = await getPlayer(playerId);
    if (!p) return;
    await client.models.Player.update({ id: playerId, individualScore: (Number(p.individualScore) || 0) + pts });
  };
  if (result === 'white') await award(game.whitePlayerId, 1);
  else if (result === 'black') await award(game.blackPlayerId, 1);
  else { await award(game.whitePlayerId, 0.5); await award(game.blackPlayerId, 0.5); }

  const updated = unwrap(await client.models.Game.update({
    id, status: 'completed', result, winnerTeamId, endedAt: new Date().toISOString(),
    ...(fen ? { fen } : {}), ...(pgn ? { pgn } : {}),
  }));

  if (game.matchId) await recomputeMatch(game.matchId);
  return after(updated);
}

/** Run async jobs in parallel chunks (AppSync-friendly). */
async function inChunks(items, size, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    results.push(...await Promise.all(chunk.map(fn)));
  }
  return results;
}

/** Create many games fast (parallel chunks instead of one-by-one). */
export async function createGamesBulk(records) {
  const created = await inChunks(records, 25, (g) =>
    client.models.Game.create({
      matchId: g.matchId ?? null, round: g.round ?? 1,
      whiteTeamId: g.whiteTeamId, whitePlayerId: g.whitePlayerId,
      blackTeamId: g.blackTeamId, blackPlayerId: g.blackPlayerId,
      fen: g.fen || INITIAL_FEN, pgn: g.pgn || '', status: 'scheduled',
      result: null, winnerTeamId: null,
      clockMs: g.clockMs ?? DEFAULT_CLOCK_MS, incrementMs: g.incrementMs ?? DEFAULT_INCREMENT_MS,
      whiteMs: g.clockMs ?? DEFAULT_CLOCK_MS, blackMs: g.clockMs ?? DEFAULT_CLOCK_MS,
      lastMoveAt: null, startedAt: null, endedAt: null,
    }).then(unwrap)
  );
  return after(created);
}

/**
 * Repair all boards: delete every SCHEDULED game (orphaned, duplicated, or
 * stale), keep live and completed games, then rebuild one board per player
 * per round from the CURRENT matches (so every game points at a real match).
 * Players already in a kept game for a round are not reseated in that round.
 */
export async function repairTournamentGames(players, currentUser = null) {
  const { generateGamesForMatches } = await import('./matchgen/tournamentPairing.js');
  const [matches, games] = await Promise.all([listMatches(), listGames()]);

  const kept = games.filter((g) => g.status === 'live' || g.status === 'completed');
  const stale = games.filter((g) => g.status === 'scheduled');

  const seatedByRound = new Map();
  for (const g of kept) {
    const s = seatedByRound.get(g.round) || new Set();
    if (g.whitePlayerId) s.add(g.whitePlayerId);
    if (g.blackPlayerId) s.add(g.blackPlayerId);
    seatedByRound.set(g.round, s);
  }

  await inChunks(stale, 25, (g) => client.models.Game.delete({ id: g.id }));

  const rebuilt = generateGamesForMatches(matches, players, seatedByRound);
  await createGamesBulk(rebuilt);

  if (currentUser) {
    await createAuditLog({
      adminEmail: currentUser.email || '',
      adminName: currentUser.displayName || '',
      action: 'REPAIR_TOURNAMENT_GAMES',
      targetType: 'Game',
      targetId: 'bulk',
      targetName: `${rebuilt.length} game(s)`,
      details: `Deleted ${stale.length} scheduled game(s) (orphans/duplicates), kept ${kept.length} live/completed, rebuilt ${rebuilt.length} board(s) from ${matches.length} match(es).`,
    });
  }

  return { deleted: stale.length, kept: kept.length, created: rebuilt.length };
}

/**
 * Reset games that were played BEFORE the competition window opened (10:00 WAT
 * on 13/11/2026). Boards were playable before the window lock deployed, so any
 * game completed (or left live) before 10:00 is invalid: take back the points
 * it awarded, restore the board to the starting position with full clocks, and
 * recompute the parent match's score/status. Games played inside the window
 * are untouched. Safe to run more than once.
 */
export async function resetPreCompetitionGames(currentUser = null) {
  const windowStart = new Date(COMPETITION_WINDOW.START_ISO).getTime();
  const games = await listGames();

  const playedBeforeWindow = (g) => {
    if (g.status === 'completed') {
      const ended = g.endedAt ? new Date(g.endedAt).getTime() : 0;
      return ended < windowStart;
    }
    if (g.status === 'live') {
      const started = g.startedAt || g.lastMoveAt;
      return !started || new Date(started).getTime() < windowStart;
    }
    return false;
  };

  const stale = games.filter(playedBeforeWindow);
  if (!stale.length) return { reset: 0, matchesRecomputed: 0 };

  // Take back points awarded by completed stale games (win 1, draw 0.5).
  const deduct = async (playerId, pts) => {
    if (!playerId || !pts) return;
    const p = await getPlayer(playerId);
    if (!p) return; // bot opponents have no Player record
    const next = Math.max(0, (Number(p.individualScore) || 0) - pts);
    await client.models.Player.update({ id: playerId, individualScore: next });
  };

  const affectedMatchIds = new Set();
  for (const g of stale) {
    if (g.status === 'completed') {
      if (g.result === 'white') await deduct(g.whitePlayerId, 1);
      else if (g.result === 'black') await deduct(g.blackPlayerId, 1);
      else if (g.result === 'draw') { await deduct(g.whitePlayerId, 0.5); await deduct(g.blackPlayerId, 0.5); }
    }
    const clockMs = g.clockMs || DEFAULT_CLOCK_MS;
    await client.models.Game.update({
      id: g.id, status: 'scheduled', result: null, winnerTeamId: null,
      fen: INITIAL_FEN, pgn: '',
      whiteMs: clockMs, blackMs: clockMs, lastMoveAt: null,
      startedAt: null, endedAt: null,
    });
    if (g.matchId) affectedMatchIds.add(g.matchId);
  }

  // Recompute each affected match; a match with no completed/live games left
  // goes back to 'scheduled'.
  for (const matchId of affectedMatchIds) {
    const match = unwrap(await client.models.Match.get({ id: matchId }, PUB));
    if (!match) continue;
    const mGames = await listAll('Game', { filter: { matchId: { eq: matchId } } });
    let a = 0, b = 0, anyLive = false, anyDone = false, allDone = mGames.length > 0;
    for (const g of mGames) {
      if (g.status === 'live') anyLive = true;
      if (g.status !== 'completed') { allDone = false; continue; }
      anyDone = true;
      const wPts = g.result === 'white' ? 1 : g.result === 'draw' ? 0.5 : 0;
      const bPts = g.result === 'black' ? 1 : g.result === 'draw' ? 0.5 : 0;
      a += g.whiteTeamId === match.teamAId ? wPts : bPts;
      b += g.blackTeamId === match.teamBId ? bPts : wPts;
    }
    const status = allDone ? 'completed' : anyLive ? 'live' : anyDone ? match.status : 'scheduled';
    await client.models.Match.update({ id: matchId, scoreA: a, scoreB: b, status });
  }

  if (currentUser) {
    await createAuditLog({
      adminEmail: currentUser.email || '',
      adminName: currentUser.displayName || '',
      action: 'RESET_PRE_COMPETITION_GAMES',
      targetType: 'Game',
      targetId: 'bulk',
      targetName: `${stale.length} game(s)`,
      details: `Reset ${stale.length} game(s) played before the 10:00 WAT competition start; points taken back and ${affectedMatchIds.size} match(es) recomputed.`,
    });
  }

  return { reset: stale.length, matchesRecomputed: affectedMatchIds.size };
}

/** Roll a match's completed games up into its team scores. */
async function recomputeMatch(matchId) {
  const match = unwrap(await client.models.Match.get({ id: matchId }, PUB));
  if (!match) return;
  const games = await listAll('Game', { filter: { matchId: { eq: matchId } } });
  let a = 0, b = 0, anyLive = false, allDone = true;
  for (const g of games) {
    if (g.status === 'live') anyLive = true;
    if (g.status !== 'completed') { allDone = false; continue; }
    const wPts = g.result === 'white' ? 1 : g.result === 'draw' ? 0.5 : 0;
    const bPts = g.result === 'black' ? 1 : g.result === 'draw' ? 0.5 : 0;
    a += g.whiteTeamId === match.teamAId ? wPts : bPts;
    b += g.blackTeamId === match.teamBId ? bPts : wPts;
  }
  const status = allDone ? 'completed' : anyLive ? 'live' : match.status;
  await client.models.Match.update({ id: matchId, scoreA: a, scoreB: b, status });
}

// ── User profiles (role/link data; Cognito owns credentials) ────────────────
export const listUsers = () => listAll('UserProfile', { authMode: 'userPool' });

export async function findUser(email) {
  const rows = await listAll('UserProfile', {
    authMode: 'userPool',
    filter: { email: { eq: String(email).toLowerCase() } },
  });
  return rows[0] ?? null;
}

export async function createUser(user) {
  const email = String(user.email).toLowerCase();
  // Upsert: a profile can already exist from an earlier (failed or deleted)
  // registration with the same email. Creating a duplicate row left accounts
  // with stale roles/links; update the existing profile instead.
  const existing = await findUser(email).catch(() => null);
  if (existing) {
    return after(unwrap(await client.models.UserProfile.update({ ...user, id: existing.id, email })));
  }
  const created = unwrap(await client.models.UserProfile.create({ ...user, email }));
  return after(created);
}

export async function updateUser(email, patch) {
  const existing = await findUser(email);
  if (!existing) return null;
  return after(unwrap(await client.models.UserProfile.update({ id: existing.id, ...patch })));
}

// ── Admin data tools (Amplify-backed) ───────────────────────────────────────
/** Reset to a clean, empty pre-launch competition (Admins only). */
export async function clearData() {
  for (const model of ['Game', 'Match', 'Player', 'Team']) {
    const rows = await listAll(model);
    await Promise.all(rows.map((r) => client.models[model].delete({ id: r.id })));
  }
  await updateTournament({ ...SEED_TOURNAMENT, status: 'registration' });
  return after(true);
}

/** Load the demo dataset — admin/testing only. Preserves sample ids + links. */
export async function loadSampleData() {
  await clearData();
  await Promise.all(SAMPLE_TEAMS.map((t) => client.models.Team.create({
    id: t.id, name: t.name, status: t.status, round: t.round, state: t.state,
    joinCode: t.joinCode, logoUrl: t.logoUrl || '', coachId: t.coachId ?? null,
  })));
  await Promise.all(SAMPLE_PLAYERS.map((p) => client.models.Player.create({
    id: p.id, teamId: p.teamId, displayName: p.displayName, email: p.email,
    individualScore: p.individualScore, isCaptain: !!p.isCaptain,
  })));
  await Promise.all(SAMPLE_MATCHES.map((m) => client.models.Match.create({
    id: m.id, round: m.round, teamAId: m.teamAId, teamBId: m.teamBId,
    scoreA: m.scoreA, scoreB: m.scoreB, scheduledAt: m.scheduledAt, status: m.status,
  })));
  await Promise.all(SAMPLE_GAMES.map((g) => client.models.Game.create({
    id: g.id, matchId: g.matchId, round: g.round,
    whiteTeamId: g.whiteTeamId, whitePlayerId: g.whitePlayerId,
    blackTeamId: g.blackTeamId, blackPlayerId: g.blackPlayerId,
    fen: g.fen, pgn: g.pgn, status: g.status, result: g.result, winnerTeamId: g.winnerTeamId,
    clockMs: g.clockMs, incrementMs: g.incrementMs, whiteMs: g.whiteMs, blackMs: g.blackMs,
    lastMoveAt: g.lastMoveAt, startedAt: g.startedAt, endedAt: g.endedAt,
  })));
  await updateTournament({ status: 'in-progress' });
  return after(true);
}
