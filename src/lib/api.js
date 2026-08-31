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
import { INITIAL_FEN, SEED_TOURNAMENT, SAMPLE_TEAMS, SAMPLE_PLAYERS, SAMPLE_MATCHES, SAMPLE_GAMES } from './seed.js';

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

// ── Teams ────────────────────────────────────────────────────────────────---
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

export async function createTeam({ name, logoUrl = '', coachId = null, status = 'active', state = '' }) {
  let round = 1;
  try { round = (await getTournament())?.currentRound ?? 1; } catch { /* default */ }
  const team = unwrap(await client.models.Team.create({
    name, logoUrl, status, coachId, state, round, joinCode: genJoinCode(),
  }));
  return after(team);
}

export async function updateTeam(id, patch) {
  return after(unwrap(await client.models.Team.update({ id, ...patch })));
}

export async function deleteTeam(id) {
  const [players, matches, games] = await Promise.all([
    listAll('Player', { filter: { teamId: { eq: id } } }),
    listAll('Match', { filter: { or: [{ teamAId: { eq: id } }, { teamBId: { eq: id } }] } }),
    listAll('Game', { filter: { or: [{ whiteTeamId: { eq: id } }, { blackTeamId: { eq: id } }] } }),
  ]);
  await Promise.all([
    ...players.map((p) => client.models.Player.delete({ id: p.id })),
    ...matches.map((m) => client.models.Match.delete({ id: m.id })),
    ...games.map((g) => client.models.Game.delete({ id: g.id })),
  ]);
  await client.models.Team.delete({ id });
  return after(true);
}

export const approveTeam = (id) => updateTeam(id, { status: 'active' });
export const rejectTeam = (id) => deleteTeam(id);

// ── Players ──────────────────────────────────────────────────────────────---
export const listPlayers = () => listAll('Player');
export async function listPlayersByTeam(teamId) {
  return listAll('Player', { filter: { teamId: { eq: teamId } } });
}
export async function getPlayer(id) {
  return unwrap(await client.models.Player.get({ id }, PUB)) || null;
}

export async function createPlayer({ teamId, displayName, email, isCaptain = false, individualScore = 0 }) {
  const player = unwrap(await client.models.Player.create({
    teamId, displayName, email, isCaptain, individualScore,
  }));
  return after(player);
}

export async function updatePlayer(id, patch) {
  return after(unwrap(await client.models.Player.update({ id, ...patch })));
}

export async function deletePlayer(id) {
  await client.models.Player.delete({ id });
  return after(true);
}

// ── Matches (team fixtures) ─────────────────────────────────────────────────
export const listMatches = () => listAll('Match');

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
  const matches = await listAll('Match', { filter: { round: { eq: round } } });
  const ids = new Set(matches.map((m) => m.id));
  const games = await listAll('Game', { filter: { round: { eq: round } } });
  await Promise.all([
    ...matches.map((m) => client.models.Match.delete({ id: m.id })),
    ...games.filter((g) => ids.has(g.matchId)).map((g) => client.models.Game.delete({ id: g.id })),
  ]);
  return after(true);
}

// ── Games (playable chess boards — the scored unit) ─────────────────────────
export const listGames = () => listAll('Game');
export async function getGame(id) {
  return unwrap(await client.models.Game.get({ id }, PUB)) || null;
}

// Default time control: 10 minutes each with a 3-second increment per move.
export const DEFAULT_CLOCK_MS = 10 * 60 * 1000;
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
  const created = unwrap(await client.models.UserProfile.create({
    ...user, email: String(user.email).toLowerCase(),
  }));
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
