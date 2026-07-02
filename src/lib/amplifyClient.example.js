// ─────────────────────────────────────────────────────────────────────────
// EXAMPLE — how to swap src/lib/api.js over to the deployed Amplify backend.
//
// This file is NOT imported anywhere. Once `npx ampx sandbox` (or a deploy) has
// generated amplify_outputs.json, copy the relevant bits into src/lib/api.js
// (or rename this to api.js). Every function keeps the same name + return shape
// the UI already expects, so no page/component needs to change.
// ─────────────────────────────────────────────────────────────────────────

/*
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from '../../amplify_outputs.json';

Amplify.configure(outputs);

// `apiKey` lets public/guest pages read; signed-in calls use 'userPool'.
const client = generateClient(); // <Schema> in a .ts file

// ── Teams ────────────────────────────────────────────────────────────────
export async function listTeams() {
  const { data } = await client.models.Team.list({ authMode: 'apiKey' });
  return data;
}

export async function getTeamByJoinCode(code) {
  const { data } = await client.models.Team.list({
    filter: { joinCode: { eq: String(code).toUpperCase() } },
    authMode: 'apiKey',
  });
  return data[0] ?? null;
}

export async function createTeam({ name, logoUrl = '' }) {
  const { data } = await client.models.Team.create({
    name, logoUrl, status: 'pending', round: 1, joinCode: genJoinCode(),
  });
  return data;
}

export const approveTeam = (id) => client.models.Team.update({ id, status: 'active' });

// ── Players / Matches / Tournament follow the same pattern ─────────────────
export async function updatePlayer(id, patch) {
  const { data } = await client.models.Player.update({ id, ...patch });
  return data;
}

export async function createMatches(records) {
  return Promise.all(records.map((r) => client.models.Match.create(r)));
}

// Live updates: instead of the localStorage 'change' event, subscribe to
// AppSync observeQuery for real-time leaderboard/score updates, e.g.:
//   client.models.Team.observeQuery().subscribe({ next: ({ items }) => ... })

// ── Auth (replace the mock in context/AuthContext.jsx) ─────────────────────
// import { signIn, signUp, confirmSignUp, getCurrentUser, signOut,
//          fetchAuthSession } from 'aws-amplify/auth';
// isAdmin = (await fetchAuthSession()).tokens?.accessToken
//             ?.payload['cognito:groups']?.includes('Admins');
*/

export {};
