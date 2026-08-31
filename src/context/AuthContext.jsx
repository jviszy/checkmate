// Auth context — AWS Cognito (Amplify Auth) edition.
//
// Cognito owns credentials and confirms accounts automatically (pre-sign-up
// trigger), so registration is frictionless. A signed-in user's role comes from
// their Cognito group ('Admins') and their UserProfile row (coach/player). The
// shape exposed to the app is identical to the old mock, so pages don't change.
//
// Roles: 'admin' (organizer, Cognito "Admins" group) · 'coach' · 'player'.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signUp as amplifySignUp,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  autoSignIn,
  getCurrentUser,
  fetchAuthSession,
  fetchUserAttributes,
} from 'aws-amplify/auth';
import {
  findUser, createUser, createPlayer, createTeam, getTeamByJoinCode,
} from '../lib/api.js';

const AuthContext = createContext(null);

async function signOutSafe() {
  try { await amplifySignOut(); } catch { /* ignore */ }
}

/** Read the current Cognito session into the app's user shape. */
async function loadSession() {
  const session = await fetchAuthSession();
  const groups = session.tokens?.accessToken?.payload['cognito:groups'];
  const isAdmin = Array.isArray(groups) && groups.includes('Admins');

  let email = '';
  try { email = (await fetchUserAttributes()).email || ''; } catch { /* ignore */ }

  let profile = null;
  try { profile = email ? await findUser(email) : null; } catch { /* ignore */ }

  return {
    email: profile?.email || email,
    displayName: profile?.displayName || (email ? email.split('@')[0] : 'User'),
    role: isAdmin ? 'admin' : (profile?.role || 'player'),
    playerId: profile?.playerId || null,
    teamId: profile?.teamId || null,
    coachId: profile?.coachId || null,
  };
}

/** Create the account (auto-confirmed) and leave the user signed in. */
async function signUpAndSignIn(email, password) {
  await signOutSafe();
  try {
    const res = await amplifySignUp({
      username: email,
      password,
      options: { userAttributes: { email }, autoSignIn: true },
    });
    if (res.nextStep?.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
      try { await autoSignIn(); } catch { /* fall through to explicit sign-in */ }
    }
  } catch (e) {
    if (e?.name === 'UsernameExistsException') {
      throw new Error('An account with that email already exists.');
    }
    if (e?.name === 'InvalidPasswordException') {
      throw new Error('Password must be at least 8 characters.');
    }
    throw e;
  }
  try { await getCurrentUser(); return; } catch { /* not signed in yet */ }
  await amplifySignIn({ username: email, password });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await getCurrentUser();
        setUser(await loadSession());
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email, password) => {
    await signOutSafe();
    try {
      await amplifySignIn({ username: email, password });
    } catch (e) {
      if (e?.name === 'UserNotFoundException' || e?.name === 'NotAuthorizedException') {
        throw new Error('Incorrect email or password.');
      }
      if (e?.name === 'UserAlreadyAuthenticatedException') {
        // already signed in as this user — just load it
      } else {
        throw e;
      }
    }
    const session = await loadSession();
    setUser(session);
    return session;
  }, []);

  // Captain registers a brand new team — goes live immediately.
  const registerCaptain = useCallback(async ({ email, password, displayName, teamName, state }) => {
    await signUpAndSignIn(email, password);
    const team = await createTeam({ name: teamName, state });
    const player = await createPlayer({ teamId: team.id, displayName, email, isCaptain: true });
    await createUser({ email, displayName, role: 'player', playerId: player.id, teamId: team.id, coachId: null });
    setUser({ email, displayName, role: 'player', playerId: player.id, teamId: team.id, coachId: null });
    return { team, player };
  }, []);

  // Member joins an existing team with its join code.
  const registerMember = useCallback(async ({ email, password, displayName, joinCode }) => {
    const team = await getTeamByJoinCode(joinCode);
    if (!team) throw new Error('No team found for that join code.');
    await signUpAndSignIn(email, password);
    const player = await createPlayer({ teamId: team.id, displayName, email, isCaptain: false });
    await createUser({ email, displayName, role: 'player', playerId: player.id, teamId: team.id, coachId: null });
    setUser({ email, displayName, role: 'player', playerId: player.id, teamId: team.id, coachId: null });
    return { team, player };
  }, []);

  // Coach registers — gets their own coachId and manages teams from /coach.
  const registerCoach = useCallback(async ({ email, password, displayName }) => {
    await signUpAndSignIn(email, password);
    const coachId = `coach_${Math.random().toString(36).slice(2, 9)}`;
    await createUser({ email, displayName, role: 'coach', playerId: null, teamId: null, coachId });
    setUser({ email, displayName, role: 'coach', playerId: null, teamId: null, coachId });
    return { coachId };
  }, []);

  const signOut = useCallback(async () => {
    await signOutSafe();
    setUser(null);
  }, []);

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
