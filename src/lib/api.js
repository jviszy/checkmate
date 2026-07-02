// ─────────────────────────────────────────────────────────────────────────
// Data layer.
//
// This is the SINGLE place the UI talks to for data. Today it's backed by
// localStorage (so the whole app runs and is reviewable with no backend).
// When the AWS Amplify Gen 2 backend is deployed, swap the bodies of these
// functions for `generateClient()` calls (see amplify/data/resource.ts) —
// the function signatures and return shapes are designed to match, so no UI
// component needs to change.
// ─────────────────────────────────────────────────────────────────────────

import {
  SEED_TEAMS, SEED_PLAYERS, SEED_MATCHES, SEED_TOURNAMENT, SEED_USERS,
} from './seed.js';

const KEY = 'checkmate.db.v1';
const EVT = 'checkmate:change';

function load() {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fall through to seed */ }
  }
  const fresh = {
    teams: SEED_TEAMS,
    players: SEED_PLAYERS,
    matches: SEED_MATCHES,
    tournament: SEED_TOURNAMENT,
    users: SEED_USERS,
  };
  localStorage.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}

let db = load();

function persist() {
  localStorage.setItem(KEY, JSON.stringify(db));
  window.dispatchEvent(new Event(EVT));
}

/** Subscribe to any data change. Returns an unsubscribe fn. */
export function onChange(cb) {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
}

/** Wipe local data back to the seed (handy for demos). */
export function resetData() {
  localStorage.removeItem(KEY);
  db = load();
  window.dispatchEvent(new Event(EVT));
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

// ── Tournament ─────────────────────────────────────────────────────────────
export const getTournament = () => ok(db.tournament);
export function updateTournament(patch) {
  db.tournament = { ...db.tournament, ...patch };
  persist();
  return ok(db.tournament);
}

// ── Teams ────────────────────────────────────────────────────────────────--
export const listTeams = () => ok(db.teams);
export const getTeam = (id) => ok(db.teams.find((t) => t.id === id) || null);
export const getTeamByJoinCode = (code) =>
  ok(db.teams.find((t) => t.joinCode?.toUpperCase() === String(code).toUpperCase()) || null);

export function createTeam({ name, logoUrl = '' }) {
  const team = {
    id: uid('team'),
    name,
    logoUrl,
    status: 'pending',
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
  persist();
  return ok(true);
}

export const approveTeam = (id) => updateTeam(id, { status: 'active' });
export const rejectTeam = (id) => deleteTeam(id);

// ── Players ────────────────────────────────────────────────────────────────
export const listPlayers = () => ok(db.players);
export const listPlayersByTeam = (teamId) =>
  ok(db.players.filter((p) => p.teamId === teamId));
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

// ── Matches ──────────────────────────────────────────────────────────────--
export const listMatches = () => ok(db.matches);

export function createMatches(records) {
  const created = records.map((r) => ({ id: uid('m'), ...r }));
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
  db.matches = db.matches.filter((m) => m.round !== round);
  persist();
  return ok(true);
}

// ── Mock auth users (replaced by Cognito under Amplify) ─────────────────────
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
    u.email.toLowerCase() === email.toLowerCase() ? { ...u, ...patch } : u
  );
  persist();
  return ok(db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()));
}
