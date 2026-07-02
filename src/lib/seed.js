// Demo data used by the local (offline) data layer so the whole app is
// reviewable without a deployed backend. When Amplify is wired up this seed
// is ignored — see src/lib/api.js.

export const SEED_TOURNAMENT = {
  id: 'main',
  name: 'Checkmate 2026',
  currentRound: 1,
  advanceCount: 6,
  status: 'in-progress',
};

// Helper to build a team + its players quickly.
let pid = 0;
function team(id, name, players) {
  const members = players.map(([displayName, score, isCaptain]) => ({
    id: `p${++pid}`,
    teamId: id,
    displayName,
    email: `${displayName.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
    individualScore: score,
    isCaptain: !!isCaptain,
  }));
  return {
    team: {
      id,
      name,
      status: 'active',
      round: 1,
      joinCode: id.toUpperCase() + '24',
      logoUrl: '',
      createdAt: '2026-06-01T09:00:00.000Z',
    },
    players: members,
  };
}

const RAW = [
  team('knights', 'Royal Knights', [
    ['Ada Okeke', 8.5, true], ['Tunde Bello', 7], ['Ngozi Eze', 6.5], ['Sami Yusuf', 5],
  ]),
  team('rooks', 'Iron Rooks', [
    ['Chidi Obi', 7, true], ['Fatima Sani', 8], ['Emeka Nwosu', 6], ['Lola Adeyemi', 4.5],
  ]),
  team('bishops', 'Diagonal Bishops', [
    ['Kemi Ade', 6, true], ['John Paul', 5.5], ['Zainab Musa', 7.5], ['Peter Eze', 5],
  ]),
  team('pawnstorm', 'Pawn Storm', [
    ['Ibrahim Sule', 5, true], ['Grace Udo', 6], ['Daniel Oji', 4], ['Aisha Bello', 6.5],
  ]),
  team('queens', 'Queen Gambit', [
    ['Nneka Ali', 9, true], ['Yusuf Garba', 7.5], ['Bisi Alabi', 6], ['Tariq Bala', 5.5],
  ]),
  team('castle', 'Castle Guard', [
    ['Mary Joseph', 4, true], ['Femi Cole', 5], ['Hauwa Idris', 4.5], ['Obi Kalu', 3.5],
  ]),
  team('endgame', 'Endgame Masters', [
    ['Sade Lawal', 6, true], ['Musa Tanko', 5], ['Rita Effiong', 5.5], ['Ken Uche', 4],
  ]),
  team('checkers', 'The Checkmates', [
    ['Joy Ekwueme', 7, true], ['Hassan Abu', 6.5], ['Tope Ojo', 5], ['Ada Bright', 6],
  ]),
  team('opening', 'Opening Theory', [
    ['Bola Tinu', 3, true], ['Kunle Aro', 4], ['Esther Pius', 3.5], ['Sani Dauda', 2.5],
  ]),
  team('zugzwang', 'Zugzwang FC', [
    ['Chioma Eze', 5.5, true], ['Ali Mohammed', 4], ['Faith Okon', 5], ['Dele Smith', 4.5],
  ]),
];

export const SEED_TEAMS = RAW.map((r) => r.team);
export const SEED_PLAYERS = RAW.flatMap((r) => r.players);

// A pending registration awaiting admin approval (demonstrates the approval flow).
SEED_TEAMS.push({
  id: 'newcomers',
  name: 'Rising Pawns',
  status: 'pending',
  round: 1,
  joinCode: 'NEWCOMERS24',
  logoUrl: '',
  createdAt: '2026-06-20T14:30:00.000Z',
});
SEED_PLAYERS.push({
  id: 'p99',
  teamId: 'newcomers',
  displayName: 'Victor Hart',
  email: 'victor@example.com',
  individualScore: 0,
  isCaptain: true,
});

// Round 1 fixtures — all upcoming. The competition hasn't started yet, so the
// public leaderboard stays hidden until an organizer completes the first match.
export const SEED_MATCHES = [
  { id: 'm1', round: 1, teamAId: 'knights', teamBId: 'castle', scoreA: 0, scoreB: 0, scheduledAt: '2026-07-05T10:00:00.000Z', status: 'scheduled' },
  { id: 'm2', round: 1, teamAId: 'queens', teamBId: 'opening', scoreA: 0, scoreB: 0, scheduledAt: '2026-07-05T12:00:00.000Z', status: 'scheduled' },
  { id: 'm3', round: 1, teamAId: 'rooks', teamBId: 'zugzwang', scoreA: 0, scoreB: 0, scheduledAt: '2026-07-06T10:00:00.000Z', status: 'scheduled' },
  { id: 'm4', round: 1, teamAId: 'bishops', teamBId: 'endgame', scoreA: 0, scoreB: 0, scheduledAt: '2026-07-06T12:00:00.000Z', status: 'scheduled' },
  { id: 'm5', round: 1, teamAId: 'checkers', teamBId: 'pawnstorm', scoreA: 0, scoreB: 0, scheduledAt: '2026-07-07T10:00:00.000Z', status: 'scheduled' },
  { id: 'm6', round: 1, teamAId: 'knights', teamBId: 'queens', scoreA: 0, scoreB: 0, scheduledAt: '2026-07-07T12:00:00.000Z', status: 'scheduled' },
  { id: 'm7', round: 1, teamAId: 'rooks', teamBId: 'bishops', scoreA: 0, scoreB: 0, scheduledAt: '2026-07-08T10:00:00.000Z', status: 'scheduled' },
];

// Demo accounts for the mock auth provider. Passwords are obviously not secure —
// real auth comes from Cognito once the Amplify backend is deployed.
export const SEED_USERS = [
  { email: 'admin@coderina.org', password: 'admin123', displayName: 'Coderina Admin', isAdmin: true, playerId: null, teamId: null },
  { email: 'adaokeke@example.com', password: 'player123', displayName: 'Ada Okeke', isAdmin: false, playerId: 'p1', teamId: 'knights' },
];
