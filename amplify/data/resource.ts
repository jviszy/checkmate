import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Checkmate data model (AWS AppSync + DynamoDB).
 *
 * Authorization model — tuned for a school chess event, not a bank:
 *  - PUBLIC (API key) can READ teams, players, matches, games and the tournament.
 *    This powers the public landing page: leaderboard, schedule and live boards,
 *    all visible without signing in.
 *  - Any SIGNED-IN user (Cognito user pool) can create their team + players at
 *    registration, and can update games/players/matches as games are played
 *    (completing a board awards points to BOTH players and rolls the result up
 *    into the parent match — so writes are intentionally not owner-scoped).
 *  - The "Admins" Cognito group has FULL control, including delete (removing
 *    teams, regenerating fixtures, advancing rounds, editing any score).
 *  - UserProfile is owner-scoped: each account reads/writes only its own profile;
 *    Admins can read every profile.
 *
 * The frontend's src/lib/api.js talks to these models via generateClient().
 */
const schema = a.schema({
  UserProfile: a
    .model({
      email: a.string().required(),
      displayName: a.string(),
      role: a.enum(['admin', 'coach', 'player']),
      playerId: a.string(),
      teamId: a.string(),
      coachId: a.string(),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.group('Admins'),
      allow.authenticated().to(['read']),
    ]),

  Team: a
    .model({
      name: a.string().required(),
      logoUrl: a.string(),
      status: a.enum(['pending', 'active', 'advanced', 'eliminated']),
      round: a.integer().default(1),
      joinCode: a.string().required(),
      coachId: a.string(),
      state: a.string(),
      players: a.hasMany('Player', 'teamId'),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(['read']),
      allow.authenticated().to(['read', 'create', 'update']),
      allow.group('Admins'),
    ]),

  Player: a
    .model({
      displayName: a.string().required(),
      email: a.string().required(),
      teamId: a.id().required(),
      team: a.belongsTo('Team', 'teamId'),
      isCaptain: a.boolean().default(false),
      individualScore: a.float().default(0),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(['read']),
      allow.authenticated().to(['read', 'create', 'update']),
      allow.group('Admins'),
    ]),

  Match: a
    .model({
      round: a.integer().required(),
      teamAId: a.id().required(),
      teamBId: a.id().required(),
      scoreA: a.float().default(0),
      scoreB: a.float().default(0),
      scheduledAt: a.datetime(),
      status: a.enum(['scheduled', 'live', 'completed']),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(['read']),
      allow.authenticated().to(['read', 'update']),
      allow.group('Admins'),
    ]),

  Game: a
    .model({
      matchId: a.string(),
      round: a.integer().default(1),
      whiteTeamId: a.string(),
      whitePlayerId: a.string(),
      blackTeamId: a.string(),
      blackPlayerId: a.string(),
      fen: a.string(),
      pgn: a.string(),
      status: a.enum(['scheduled', 'live', 'completed']),
      result: a.string(),
      winnerTeamId: a.string(),
      clockMs: a.integer(),
      incrementMs: a.integer(),
      whiteMs: a.integer(),
      blackMs: a.integer(),
      lastMoveAt: a.string(),
      startedAt: a.string(),
      endedAt: a.string(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(['read']),
      allow.authenticated().to(['read', 'update']),
      allow.group('Admins'),
    ]),

  Tournament: a
    .model({
      name: a.string().required(),
      currentRound: a.integer().default(1),
      winnersPerZone: a.integer().default(1),
      status: a.string(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(['read']),
      allow.authenticated().to(['read']),
      allow.group('Admins'),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    // Public read uses the API key; signed-in users/admins use Cognito.
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: { expiresInDays: 365 },
  },
});
