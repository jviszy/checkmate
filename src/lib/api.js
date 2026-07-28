// ─────────────────────────────────────────────────────────────────────────
// Data layer.
//
// The SINGLE place the UI talks to for data. Backed by AWS Amplify Gen 2 AppSync
// subscriptions so live games and the scoreboard update everywhere at once.
// ─────────────────────────────────────────────────────────────────────────

import { generateClient } from 'aws-amplify/data';
import { INITIAL_FEN } from './seed.js';

// The amplify client instance (assumes main.jsx has configured Amplify)
const client = generateClient();
const ok = (v) => Promise.resolve(v);

export function onChange(cb) {
  const sub1 = client.models.Game.onUpdate().subscribe({ next: () => cb() });
  const sub2 = client.models.Match.onUpdate().subscribe({ next: () => cb() });
  const sub3 = client.models.Tournament.onUpdate().subscribe({ next: () => cb() });
  return () => {
    sub1.unsubscribe();
    sub2.unsubscribe();
    sub3.unsubscribe();
  };
}

export function loadSampleData() { /* no-op in cloud */ }
export function clearData() { /* no-op in cloud */ }

// ── Tournament ──────────────────────────────────────────────────────────────
export const getTournament = async () => {
  const { data } = await client.models.Tournament.list();
  if (data.length === 0) {
    const { data: newT } = await client.models.Tournament.create({ name: "Checkmate Tournament", currentRound: 1, advanceCount: 6 });
    return newT;
  }
  return data[0];
};

export async function updateTournament(patch) {
  const t = await getTournament();
  if (!t) return null;
  const { data } = await client.models.Tournament.update({ id: t.id, ...patch });
  return data;
}

// ── Teams ─────────────────────────────────────────────────────────────────--
export const listTeams = async () => (await client.models.Team.list()).data;
export const getTeam = async (id) => (await client.models.Team.get({ id })).data;
export const listTeamsByCoach = async (coachId) => (await client.models.Team.list({ filter: { coachId: { eq: coachId } } })).data;
export const getTeamByJoinCode = async (code) => {
  const { data } = await client.models.Team.list({ filter: { joinCode: { eq: String(code).toUpperCase() } } });
  return data[0] || null;
};

export async function createTeam({ name, logoUrl = '', coachId = null, status = 'active', state = '' }) {
  const t = await getTournament();
  const joinCode = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const { data } = await client.models.Team.create({ name, logoUrl, status, coachId, state, joinCode, round: t?.currentRound || 1 });
  return data;
}

export async function updateTeam(id, patch) {
  const { data } = await client.models.Team.update({ id, ...patch });
  return data;
}

export async function deleteTeam(id) {
  await client.models.Team.delete({ id });
  return true;
}

export const approveTeam = (id) => updateTeam(id, { status: 'active' });
export const rejectTeam = (id) => deleteTeam(id);

// ── Players ───────────────────────────────────────────────────────────────--
export const listPlayers = async () => (await client.models.Player.list()).data;
export const listPlayersByTeam = async (teamId) => (await client.models.Player.list({ filter: { teamId: { eq: teamId } } })).data;
export const getPlayer = async (id) => (await client.models.Player.get({ id })).data;

export async function createPlayer({ teamId, displayName, email, isCaptain = false, individualScore = 0 }) {
  const { data } = await client.models.Player.create({ teamId, displayName, email, isCaptain, individualScore });
  return data;
}

export async function updatePlayer(id, patch) {
  const { data } = await client.models.Player.update({ id, ...patch });
  return data;
}

export async function deletePlayer(id) {
  await client.models.Player.delete({ id });
  return true;
}

// ── Matches (team fixtures) ─────────────────────────────────────────────────
export const listMatches = async () => (await client.models.Match.list()).data;

export async function createMatches(records) {
  const created = [];
  for (const r of records) {
    const { data } = await client.models.Match.create({ scoreA: 0, scoreB: 0, status: 'scheduled', ...r });
    created.push(data);
  }
  return created;
}

export async function updateMatch(id, patch) {
  const { data } = await client.models.Match.update({ id, ...patch });
  return data;
}

export async function deleteMatchesForRound(round) {
  const { data } = await client.models.Match.list({ filter: { round: { eq: round } } });
  for (const m of data) await client.models.Match.delete({ id: m.id });
  return true;
}

// ── Games (playable chess boards — the scored unit) ─────────────────────────
export const listGames = async () => (await client.models.Game.list()).data;
export const getGame = async (id) => (await client.models.Game.get({ id })).data;

export const DEFAULT_CLOCK_MS = 10 * 60 * 1000;
export const DEFAULT_INCREMENT_MS = 3 * 1000;

export async function createGame({
  matchId = null, round = 1, whiteTeamId, whitePlayerId, blackTeamId, blackPlayerId,
  clockMs = DEFAULT_CLOCK_MS, incrementMs = DEFAULT_INCREMENT_MS,
}) {
  const { data } = await client.models.Game.create({
    matchId, round, whiteTeamId, whitePlayerId, blackTeamId, blackPlayerId,
    fen: INITIAL_FEN, pgn: '', status: 'scheduled', clockMs, incrementMs, whiteMs: clockMs, blackMs: clockMs
  });
  return data;
}

export async function updateGame(id, { fen, pgn, status, whiteMs, blackMs, lastMoveAt }) {
  const patch = { id };
  if (fen !== undefined) patch.fen = fen;
  if (pgn !== undefined) patch.pgn = pgn;
  if (whiteMs !== undefined) patch.whiteMs = whiteMs;
  if (blackMs !== undefined) patch.blackMs = blackMs;
  if (lastMoveAt !== undefined) patch.lastMoveAt = lastMoveAt;
  
  const g = await getGame(id);
  if (status) patch.status = status;
  else if (g?.status === 'scheduled') patch.status = 'live';
  
  if (patch.status === 'live' && g && !g.startedAt) patch.startedAt = new Date().toISOString();

  const { data } = await client.models.Game.update(patch);
  return data;
}

export async function completeGame(id, result, { fen, pgn } = {}) {
  const game = await getGame(id);
  if (!game || game.status === 'completed') return game;

  const winnerTeamId = result === 'white' ? game.whiteTeamId : result === 'black' ? game.blackTeamId : null;
  const patch = { id, status: 'completed', result, winnerTeamId, endedAt: new Date().toISOString() };
  if (fen) patch.fen = fen;
  if (pgn) patch.pgn = pgn;
  
  await client.models.Game.update(patch);
  
  const award = async (playerId, pts) => {
    const p = await getPlayer(playerId);
    if (p) await client.models.Player.update({ id: playerId, individualScore: (Number(p.individualScore) || 0) + pts });
  };
  
  if (result === 'white') await award(game.whitePlayerId, 1);
  else if (result === 'black') await award(game.blackPlayerId, 1);
  else { await award(game.whitePlayerId, 0.5); await award(game.blackPlayerId, 0.5); }

  if (game.matchId) await recomputeMatch(game.matchId);
  return await getGame(id);
}

async function recomputeMatch(matchId) {
  const match = (await client.models.Match.get({ id: matchId })).data;
  if (!match) return;
  const games = (await client.models.Game.list({ filter: { matchId: { eq: matchId } } })).data;
  
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

// ── User Profiles ───────────────────────────────────────────────────────────
export async function createUserProfile(profile) {
  const { data } = await client.models.UserProfile.create(profile);
  return data;
}
export async function getUserProfile(email) {
  const { data } = await client.models.UserProfile.list({ filter: { email: { eq: email } } });
  return data[0] || null;
}
