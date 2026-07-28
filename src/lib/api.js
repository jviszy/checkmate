// ─────────────────────────────────────────────────────────────────────────
// Data layer.
//
// The SINGLE place the UI talks to for data. Backed by localStorage today, with
// cross-tab realtime sync (BroadcastChannel + storage events) so live games and
// the scoreboard update everywhere at once — a stand-in for the AWS AppSync
// subscriptions that take over once the Amplify backend is deployed. Function
// signatures/shapes match the planned backend, so UI code won't change.
// ─────────────────────────────────────────────────────────────────────────

import { emptyDb, sampleDb, INITIAL_FEN } from './seed.js';

const KEY = 'checkmate.db.v2';
const EVT = 'checkmate:change';

function read() {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  const fresh = emptyDb();
  localStorage.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}

let db = read();

// Cross-tab realtime: broadcast a ping on every write; peers reload + refresh.
let channel = null;
try { channel = new BroadcastChannel('checkmate:sync'); } catch { channel = null; }

function reloadFromStorage() {
  const raw = localStorage.getItem(KEY);
  if (raw) { try { db = JSON.parse(raw); } catch { /* ignore */ } }
  window.dispatchEvent(new Event(EVT));
}

if (channel) channel.onmessage = () => reloadFromStorage();
window.addEventListener('storage', (e) => { if (e.key === KEY) reloadFromStorage(); });

function persist() {
  localStorage.setItem(KEY, JSON.stringify(db));
  window.dispatchEvent(new Event(EVT));
  if (channel) { try { channel.postMessage(Date.now()); } catch { /* ignore */ } }
}

/** Subscribe to any data change (local or from another tab/device). */
export function onChange(cb) {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
}

/** Load the demo dataset (teams, players, live games) — admin/testing only. */
export function loadSampleData() {
  db = sampleDb();
  persist();
}

/** Reset to a clean, empty pre-launch competition. */
export function clearData() {
  db = emptyDb();
  persist();
}

const uid = (prefix) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${(db._n = (db._n || 0) + 1)}`;
const clone = (v) => JSON.parse(JSON.stringify(v));
const ok = (v) => Promise.resolve(clone(v));

function genJoinCode() {
  return Array.from({ length: 6 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
  ).join('');
}

// ── Tournament ──────────────────────────────────────────────────────────────
export const getTournament = () => ok(db.tournament);
export function updateTournament(patch) {
  db.tournament = { ...db.tournament, ...patch };
  persist();
  return ok(db.tournament);
}

// ── Teams ─────────────────────────────────────────────────────────────────--
export const listTeams = () => ok(db.teams);
export const getTeam = (id) => ok(db.teams.find((t) => t.id === id) || null);
export const listTeamsByCoach = (coachId) => ok(db.teams.filter((t) => t.coachId === coachId));
export const getTeamByJoinCode = (code) =>
  ok(db.teams.find((t) => t.joinCode?.toUpperCase() === String(code).toUpperCase()) || null);

export function createTeam({ name, logoUrl = '', coachId = null, status = 'active', state = '' }) {
  const team = {
    id: uid('team'), name, logoUrl, status, coachId, state,
    round: db.tournament.currentRound,
    joinCode: genJoinCode(),
    createdAt: new Date().toISOString(),
  };
  db.teams = [...db.teams, team];
  persist();
  return ok(team);
}

export function updateTeam(id, patch) {
  db.teams = db.teams.map((t) => (t.id === id ? { ...t, ...patch } : t));
  persist();
  return ok(db.teams.find((t) => t.id === id));
}

export function deleteTeam(id) {
  db.teams = db.teams.filter((t) => t.id !== id);
  db.players = db.players.filter((p) => p.teamId !== id);
  db.matches = db.matches.filter((m) => m.teamAId !== id && m.teamBId !== id);
  db.games = db.games.filter((g) => g.whiteTeamId !== id && g.blackTeamId !== id);
  persist();
  return ok(true);
}

export const approveTeam = (id) => updateTeam(id, { status: 'active' });
export const rejectTeam = (id) => deleteTeam(id);

// ── Players ───────────────────────────────────────────────────────────────--
export const listPlayers = () => ok(db.players);
export const listPlayersByTeam = (teamId) => ok(db.players.filter((p) => p.teamId === teamId));
export const getPlayer = (id) => ok(db.players.find((p) => p.id === id) || null);

export function createPlayer({ teamId, displayName, email, isCaptain = false, individualScore = 0 }) {
  const player = { id: uid('p'), teamId, displayName, email, isCaptain, individualScore };
  db.players = [...db.players, player];
  persist();
  return ok(player);
}

export function updatePlayer(id, patch) {
  db.players = db.players.map((p) => (p.id === id ? { ...p, ...patch } : p));
  persist();
  return ok(db.players.find((p) => p.id === id));
}

export function deletePlayer(id) {
  db.players = db.players.filter((p) => p.id !== id);
  persist();
  return ok(true);
}

// ── Matches (team fixtures) ─────────────────────────────────────────────────
export const listMatches = () => ok(db.matches);

export function createMatches(records) {
  const created = records.map((r) => ({ id: uid('m'), scoreA: 0, scoreB: 0, ...r }));
  db.matches = [...db.matches, ...created];
  persist();
  return ok(created);
}

export function updateMatch(id, patch) {
  db.matches = db.matches.map((m) => (m.id === id ? { ...m, ...patch } : m));
  persist();
  return ok(db.matches.find((m) => m.id === id));
}

export function deleteMatchesForRound(round) {
  const ids = db.matches.filter((m) => m.round === round).map((m) => m.id);
  db.matches = db.matches.filter((m) => m.round !== round);
  db.games = db.games.filter((g) => !ids.includes(g.matchId));
  persist();
  return ok(true);
}

// ── Games (playable chess boards — the scored unit) ─────────────────────────
export const listGames = () => ok(db.games);
export const getGame = (id) => ok(db.games.find((g) => g.id === id) || null);

// Default time control: 10 minutes each with a 3-second increment per move.
export const DEFAULT_CLOCK_MS = 10 * 60 * 1000;
export const DEFAULT_INCREMENT_MS = 3 * 1000;

export function createGame({
  matchId = null, round = 1, whiteTeamId, whitePlayerId, blackTeamId, blackPlayerId,
  clockMs = DEFAULT_CLOCK_MS, incrementMs = DEFAULT_INCREMENT_MS,
}) {
  const game = {
    id: uid('game'), matchId, round,
    whiteTeamId, whitePlayerId, blackTeamId, blackPlayerId,
    fen: INITIAL_FEN, pgn: '', status: 'scheduled',
    result: null, winnerTeamId: null,
    clockMs, incrementMs, whiteMs: clockMs, blackMs: clockMs, lastMoveAt: null,
    startedAt: null, endedAt: null, createdAt: new Date().toISOString(),
  };
  db.games = [...db.games, game];
  persist();
  return ok(game);
}

/** Persist a move (fen + pgn + clocks). Flips a scheduled game to live. */
export function updateGame(id, { fen, pgn, status, whiteMs, blackMs, lastMoveAt }) {
  db.games = db.games.map((g) => {
    if (g.id !== id) return g;
    const next = { ...g, fen, pgn };
    if (whiteMs !== undefined) next.whiteMs = whiteMs;
    if (blackMs !== undefined) next.blackMs = blackMs;
    if (lastMoveAt !== undefined) next.lastMoveAt = lastMoveAt;
    if (status) next.status = status;
    else if (g.status === 'scheduled') next.status = 'live';
    if (next.status === 'live' && !g.startedAt) next.startedAt = new Date().toISOString();
    return next;
  });
  persist();
  return ok(db.games.find((g) => g.id === id));
}

/**
 * Finish a game. result: 'white' | 'black' | 'draw'.
 * Awards points to the players (win 1, draw 0.5) — which roll up into the team
 * total and the scoreboard automatically — then recomputes the parent match.
 */
export function completeGame(id, result, { fen, pgn } = {}) {
  const game = db.games.find((g) => g.id === id);
  if (!game || game.status === 'completed') return ok(game || null);

  const winnerTeamId = result === 'white' ? game.whiteTeamId : result === 'black' ? game.blackTeamId : null;
  const award = (playerId, pts) => {
    db.players = db.players.map((p) => (p.id === playerId ? { ...p, individualScore: (Number(p.individualScore) || 0) + pts } : p));
  };
  if (result === 'white') award(game.whitePlayerId, 1);
  else if (result === 'black') award(game.blackPlayerId, 1);
  else { award(game.whitePlayerId, 0.5); award(game.blackPlayerId, 0.5); }

  db.games = db.games.map((g) => (g.id === id
    ? { ...g, status: 'completed', result, winnerTeamId, endedAt: new Date().toISOString(), ...(fen ? { fen } : {}), ...(pgn ? { pgn } : {}) }
    : g));

  if (game.matchId) recomputeMatch(game.matchId);
  persist();
  return ok(db.games.find((g) => g.id === id));
}

/** Roll a match's completed games up into its team scores. */
function recomputeMatch(matchId) {
  const match = db.matches.find((m) => m.id === matchId);
  if (!match) return;
  let a = 0, b = 0, anyLive = false, allDone = true;
  for (const g of db.games.filter((x) => x.matchId === matchId)) {
    if (g.status === 'live') anyLive = true;
    if (g.status !== 'completed') { allDone = false; continue; }
    const wPts = g.result === 'white' ? 1 : g.result === 'draw' ? 0.5 : 0;
    const bPts = g.result === 'black' ? 1 : g.result === 'draw' ? 0.5 : 0;
    a += g.whiteTeamId === match.teamAId ? wPts : bPts;
    b += g.blackTeamId === match.teamBId ? bPts : wPts;
  }
  const status = allDone ? 'completed' : anyLive ? 'live' : match.status;
  db.matches = db.matches.map((m) => (m.id === matchId ? { ...m, scoreA: a, scoreB: b, status } : m));
}

// ── Users (mock auth — replaced by Cognito under Amplify) ───────────────────
export const listUsers = () => ok(db.users);
export function findUser(email) {
  return ok(db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null);
}
export function createUser(user) {
  db.users = [...db.users, user];
  persist();
  return ok(user);
}
export function updateUser(email, patch) {
  db.users = db.users.map((u) =>
    u.email.toLowerCase() === email.toLowerCase() ? { ...u, ...patch } : u);
  persist();
  return ok(db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()));
}
