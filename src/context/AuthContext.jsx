// Auth context.
//
// Backed by the mock user store today so login/registration work offline.
// When Amplify is deployed, replace the method bodies with Amplify Auth calls
// (signIn, signUp, confirmSignUp, getCurrentUser, signOut) and read the Cognito
// groups for role. The shape exposed to the app stays identical.
//
// Roles: 'admin' (organizer) · 'coach' (manages teams) · 'player'.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  findUser, createUser, createPlayer, createTeam, getTeamByJoinCode,
} from '../lib/api.js';

const AuthContext = createContext(null);
const SESSION_KEY = 'checkmate.session.v1';

function sessionFrom(u) {
  return {
    email: u.email,
    displayName: u.displayName,
    role: u.role || (u.isAdmin ? 'admin' : 'player'),
    playerId: u.playerId || null,
    teamId: u.teamId || null,
    coachId: u.coachId || null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const persistSession = useCallback((u) => {
    if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u));
    else localStorage.removeItem(SESSION_KEY);
    setUser(u);
  }, []);

  const signIn = useCallback(async (email, password) => {
    const found = await findUser(email);
    if (!found || found.password !== password) {
      throw new Error('Incorrect email or password.');
    }
    const session = sessionFrom(found);
    persistSession(session);
    return session;
  }, [persistSession]);

  // Captain registers a brand new team (pending → admin approves).
  const registerCaptain = useCallback(async ({ email, password, displayName, teamName }) => {
    if (await findUser(email)) throw new Error('An account with that email already exists.');
    const team = await createTeam({ name: teamName });
    const player = await createPlayer({ teamId: team.id, displayName, email, isCaptain: true });
    await createUser({ email, password, displayName, role: 'player', playerId: player.id, teamId: team.id, coachId: null });
    persistSession({ email, displayName, role: 'player', playerId: player.id, teamId: team.id, coachId: null });
    return { team, player };
  }, [persistSession]);

  // Member joins an existing team with its join code.
  const registerMember = useCallback(async ({ email, password, displayName, joinCode }) => {
    if (await findUser(email)) throw new Error('An account with that email already exists.');
    const team = await getTeamByJoinCode(joinCode);
    if (!team) throw new Error('No team found for that join code.');
    const player = await createPlayer({ teamId: team.id, displayName, email, isCaptain: false });
    await createUser({ email, password, displayName, role: 'player', playerId: player.id, teamId: team.id, coachId: null });
    persistSession({ email, displayName, role: 'player', playerId: player.id, teamId: team.id, coachId: null });
    return { team, player };
  }, [persistSession]);

  // Coach registers — gets their own coachId and manages teams from /coach.
  const registerCoach = useCallback(async ({ email, password, displayName }) => {
    if (await findUser(email)) throw new Error('An account with that email already exists.');
    const coachId = `coach_${Math.random().toString(36).slice(2, 9)}`;
    await createUser({ email, password, displayName, role: 'coach', playerId: null, teamId: null, coachId });
    persistSession({ email, displayName, role: 'coach', playerId: null, teamId: null, coachId });
    return { coachId };
  }, [persistSession]);

  const signOut = useCallback(async () => { persistSession(null); }, [persistSession]);

  const value = {
    user,
    loading,
    role: user?.role || null,
    isAdmin: user?.role === 'admin',
    isCoach: user?.role === 'coach',
    isAuthed: !!user,
    signIn,
    registerCaptain,
    registerMember,
    registerCoach,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
