// Auth context.
//
// Backed by the mock user store today so login/registration work offline.
// When Amplify is deployed, replace the body of these methods with Amplify
// Auth calls (signIn, signUp, confirmSignUp, getCurrentUser, signOut) and read
// the `Admins` Cognito group for `isAdmin`. The shape exposed to the app
// (user, isAdmin, signIn, signUp, signOut) stays identical.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  findUser, createUser, createPlayer, createTeam, getTeamByJoinCode, updateTeam,
} from '../lib/api.js';

const AuthContext = createContext(null);
const SESSION_KEY = 'checkmate.session.v1';

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
    const session = {
      email: found.email,
      displayName: found.displayName,
      isAdmin: !!found.isAdmin,
      playerId: found.playerId || null,
      teamId: found.teamId || null,
    };
    persistSession(session);
    return session;
  }, [persistSession]);

  // Register the captain + a brand new team (status: pending → admin approves).
  const registerCaptain = useCallback(async ({ email, password, displayName, teamName }) => {
    if (await findUser(email)) throw new Error('An account with that email already exists.');
    const team = await createTeam({ name: teamName });
    const player = await createPlayer({
      teamId: team.id, displayName, email, isCaptain: true, individualScore: 0,
    });
    await createUser({ email, password, displayName, isAdmin: false, playerId: player.id, teamId: team.id });
    const session = { email, displayName, isAdmin: false, playerId: player.id, teamId: team.id };
    persistSession(session);
    return { team, player };
  }, [persistSession]);

  // Register a member who joins an existing team using its join code.
  const registerMember = useCallback(async ({ email, password, displayName, joinCode }) => {
    if (await findUser(email)) throw new Error('An account with that email already exists.');
    const team = await getTeamByJoinCode(joinCode);
    if (!team) throw new Error('No team found for that join code.');
    const player = await createPlayer({
      teamId: team.id, displayName, email, isCaptain: false, individualScore: 0,
    });
    await createUser({ email, password, displayName, isAdmin: false, playerId: player.id, teamId: team.id });
    const session = { email, displayName, isAdmin: false, playerId: player.id, teamId: team.id };
    persistSession(session);
    return { team, player };
  }, [persistSession]);

  const signOut = useCallback(async () => { persistSession(null); }, [persistSession]);

  const value = {
    user,
    loading,
    isAdmin: !!user?.isAdmin,
    isAuthed: !!user,
    signIn,
    registerCaptain,
    registerMember,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
