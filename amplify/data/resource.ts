import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Checkmate data model (AWS AppSync + DynamoDB).
 *
 * Authorization summary:
 *  - guests/public can READ teams, matches and the tournament (powers the
 *    public leaderboard + schedule).
 *  - any signed-in user can read everything they need for their dashboard.
 *  - the "Admins" Cognito group has full create/update/delete (approvals,
 *    score entry, match generation, advancing rounds).
 *  - a captain (owner) may update their own team record.
 *
 * The frontend's src/lib/api.js mirrors these model shapes, so wiring the real
 * backend means swapping that file's bodies for generateClient<Schema>() calls.
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
      allow.guest().to(['read']),
      allow.authenticated().to(['read']),
      allow.owner().to(['read', 'update']),
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
      allow.authenticated().to(['read']),
      allow.owner().to(['read', 'update']),
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
      allow.guest().to(['read']),
      allow.authenticated().to(['read']),
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
      allow.guest().to(['read']),
      allow.authenticated().to(['read', 'update']),
      allow.group('Admins'),
    ]),

  Tournament: a
    .model({
      name: a.string().required(),
      currentRound: a.integer().default(1),
      advanceCount: a.integer().default(6),
      status: a.string(),
    })
    .authorization((allow) => [
      allow.guest().to(['read']),
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
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});
