// Data seeds.
//
// The site defaults to an EMPTY, pre-launch state (no teams/players/matches/
// games) so the live site is clean until real students register. Organizers can
// load the sample set below from the admin panel for testing/demos.

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const SEED_TOURNAMENT = {
  id: 'main',
  name: 'Checkmate 2026',
  currentRound: 1,
  advanceCount: 6,
  status: 'registration',
};

// The only account that always exists is the organizer.
export const SEED_USERS = [
  { email: 'admin@coderina.org', password: 'admin123', displayName: 'Coderina Admin', role: 'admin', playerId: null, teamId: null, coachId: null },
];

/** A fresh, empty competition — the default state. */
export function emptyDb() {
  return {
    teams: [],
    players: [],
    matches: [],
    games: [],
    tournament: { ...SEED_TOURNAMENT },
    users: SEED_USERS.map((u) => ({ ...u })),
  };
}

// ── Sample data (loaded on demand from the admin panel) ─────────────────────
let pid = 0;
function team(id, name, coachId, players) {
  const members = players.map(([displayName, score, isCaptain]) => ({
    id: `p${++pid}`,
    teamId: id,
    displayName,
    email: `${displayName.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
    individualScore: score,
    isCaptain: !!isCaptain,
  }));
  return {
    team: { id, name, status: 'active', round: 1, joinCode: id.toUpperCase().slice(0, 6) + '24', logoUrl: '', coachId, createdAt: '2026-06-01T09:00:00.000Z' },
    players: members,
  };
}

const RAW = [
  team('knights', 'Royal Knights', 'coach1', [['Ada Okeke', 0, true], ['Tunde Bello', 0], ['Ngozi Eze', 0], ['Sami Yusuf', 0]]),
  team('rooks', 'Iron Rooks', 'coach1', [['Chidi Obi', 0, true], ['Fatima Sani', 0], ['Emeka Nwosu', 0], ['Lola Adeyemi', 0]]),
  team('bishops', 'Diagonal Bishops', 'coach1', [['Kemi Ade', 0, true], ['John Paul', 0], ['Zainab Musa', 0], ['Peter Eze', 0]]),
  team('queens', 'Queen Gambit', null, [['Nneka Ali', 0, true], ['Yusuf Garba', 0], ['Bisi Alabi', 0], ['Tariq Bala', 0]]),
  team('castle', 'Castle Guard', null, [['Mary Joseph', 0, true], ['Femi Cole', 0], ['Hauwa Idris', 0], ['Obi Kalu', 0]]),
  team('opening', 'Opening Theory', null, [['Bola Tinu', 0, true], ['Kunle Aro', 0], ['Esther Pius', 0], ['Sani Dauda', 0]]),
];

export const SAMPLE_TEAMS = RAW.map((r) => r.team);
export const SAMPLE_PLAYERS = RAW.flatMap((r) => r.players);

SAMPLE_TEAMS.push({ id: 'newcomers', name: 'Rising Pawns', status: 'active', round: 1, joinCode: 'RISING24', logoUrl: '', coachId: null, createdAt: '2026-06-20T14:30:00.000Z' });
SAMPLE_PLAYERS.push({ id: 'p101', teamId: 'newcomers', displayName: 'Victor Hart', email: 'victor@example.com', individualScore: 0, isCaptain: true });

// Team fixtures (round robin subset).
export const SAMPLE_MATCHES = [
  { id: 'm1', round: 1, teamAId: 'knights', teamBId: 'castle', scoreA: 0, scoreB: 0, scheduledAt: '2026-07-05T10:00:00.000Z', status: 'scheduled' },
  { id: 'm2', round: 1, teamAId: 'queens', teamBId: 'opening', scoreA: 0, scoreB: 0, scheduledAt: '2026-07-05T12:00:00.000Z', status: 'scheduled' },
  { id: 'm3', round: 1, teamAId: 'rooks', teamBId: 'bishops', scoreA: 0, scoreB: 0, scheduledAt: '2026-07-06T10:00:00.000Z', status: 'scheduled' },
];

// Individual playable board games (the scored unit).
const CLOCK = { clockMs: 600000, incrementMs: 3000, whiteMs: 600000, blackMs: 600000, lastMoveAt: null };
export const SAMPLE_GAMES = [
  { id: 'game1', matchId: 'm1', round: 1, whiteTeamId: 'knights', whitePlayerId: 'p1', blackTeamId: 'castle', blackPlayerId: 'p17', fen: INITIAL_FEN, pgn: '', status: 'live', result: null, winnerTeamId: null, ...CLOCK, startedAt: '2026-07-05T10:00:00.000Z', endedAt: null, createdAt: '2026-07-05T09:50:00.000Z' },
  { id: 'game2', matchId: 'm2', round: 1, whiteTeamId: 'queens', whitePlayerId: 'p13', blackTeamId: 'opening', blackPlayerId: 'p21', fen: INITIAL_FEN, pgn: '', status: 'scheduled', result: null, winnerTeamId: null, ...CLOCK, startedAt: null, endedAt: null, createdAt: '2026-07-05T09:50:00.000Z' },
];

export const SAMPLE_USERS = [
  { email: 'coach@coderina.org', password: 'coach123', displayName: 'Coach Emeka', role: 'coach', playerId: null, teamId: null, coachId: 'coach1' },
  { email: 'adaokeke@example.com', password: 'player123', displayName: 'Ada Okeke', role: 'player', playerId: 'p1', teamId: 'knights' },
];

export function sampleDb() {
  return {
    teams: SAMPLE_TEAMS.map((t) => ({ ...t })),
    players: SAMPLE_PLAYERS.map((p) => ({ ...p })),
    matches: SAMPLE_MATCHES.map((m) => ({ ...m })),
    games: SAMPLE_GAMES.map((g) => ({ ...g })),
    tournament: { ...SEED_TOURNAMENT, status: 'in-progress' },
    users: [...SEED_USERS.map((u) => ({ ...u })), ...SAMPLE_USERS.map((u) => ({ ...u }))],
  };
}
