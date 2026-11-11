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
  findUser, createUser, createPlayer, createTeam, getTeamByJoinCode, listPlayersByTeam,
  validateTeamLimits, MAX_TEAM_MEMBERS,
} from '../lib/api.js';
import {
  isRegistrationOpen,
  getRegistrationDeadlineText,
  isEmailExemptTeam,
  makePendingEmailPlaceholder,
} from '../lib/tournamentConfig.js';
import { sendRegistrationConfirmation } from '../lib/notifications.js';

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
      // The Cognito account can be left over from an earlier registration that
      // failed partway, or from a team an admin deleted (deleting app data does
      // not delete the Cognito user). Reuse the account when the password
      // matches so the person can register again.
      try {
        await amplifySignIn({ username: email, password });
        return;
      } catch (signInErr) {
        if (signInErr?.name === 'UserAlreadyAuthenticatedException') return;
        throw new Error(
          'An account with this email already exists. Sign in with that account\'s password, or use "Forgot password" to reset it, then register again.'
        );
      }
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

  // Captain registers a brand new team — enforces exactly 1 coach and 2 to 5 members.
  const registerCaptain = useCallback(async ({
    email, password, displayName, teamName, state,
    coachName, coachEmail, coachPhone = '',
    additionalMembers = [],
  }) => {
    // Item 4: Registration cutoff check
    if (!isRegistrationOpen()) {
      throw new Error(`Registration closed on ${getRegistrationDeadlineText()}. New registrations are no longer accepted.`);
    }

    const isExempt = isEmailExemptTeam(teamName);

    // Member count = Captain (1) + additional members
    const allMembers = [
      {
        displayName,
        email: email || (isExempt ? makePendingEmailPlaceholder(displayName, teamName) : ''),
        isCaptain: true,
      },
      ...additionalMembers.map((m) => ({
        displayName: m.displayName || m.name,
        email: m.email || (isExempt ? makePendingEmailPlaceholder(m.displayName || m.name, teamName) : ''),
        isCaptain: false,
      })),
    ];

    const coach = {
      name: (coachName || '').trim(),
      email: (coachEmail || '').trim().toLowerCase(),
      phone: (coachPhone || '').trim(),
    };

    // Back-end validation for coach and member boundaries
    validateTeamLimits({ coach, members: allMembers, teamName });

    // For exempt team without player email, create account with coach credential if email not given or is placeholder
    const isPlaceholderEmail = typeof email === 'string' && email.startsWith('[');
    const loginEmail = (isExempt && isPlaceholderEmail) ? coach.email : (email || coach.email);
    await signUpAndSignIn(loginEmail, password);

    const team = await createTeam({
      name: teamName,
      state,
      coachName: coach.name,
      coachEmail: coach.email,
      coachId: `coach_${Math.random().toString(36).slice(2, 8)}`,
      members: allMembers,
    });

    const captainPlayerEmail = email || (isExempt ? makePendingEmailPlaceholder(displayName, teamName) : '');
    const player = await createPlayer({ teamId: team.id, displayName, email: captainPlayerEmail, isCaptain: true });

    // Create additional roster members
    const createdPlayers = [player];
    for (const m of additionalMembers) {
      if (m.displayName) {
        const mEmail = m.email || (isExempt ? makePendingEmailPlaceholder(m.displayName, teamName) : '');
        const p = await createPlayer({
          teamId: team.id,
          displayName: m.displayName.trim(),
          email: mEmail,
          isCaptain: false,
        });
        createdPlayers.push(p);
      }
    }

    await createUser({ email: loginEmail, displayName, role: 'player', playerId: player.id, teamId: team.id, coachId: null });
    setUser({ email: loginEmail, displayName, role: 'player', playerId: player.id, teamId: team.id, coachId: null });

    // Item 7: Send confirmation notification to registration email
    if (coach.email) {
      sendRegistrationConfirmation({
        to: coach.email,
        teamName: team.name,
        coachName: coach.name,
        captainName: displayName,
        joinCode: team.joinCode,
        members: createdPlayers,
      }).catch((err) => console.warn('Failed to send confirmation email', err));
    }

    return { team, player };
  }, []);

  // Member joins an existing team with its join code.
  // Validates that team has not exceeded the 5-member ceiling.
  const registerMember = useCallback(async ({ email, password, displayName, joinCode }) => {
    // Item 4: Registration cutoff check
    if (!isRegistrationOpen()) {
      throw new Error(`Registration closed on ${getRegistrationDeadlineText()}. New registrations are no longer accepted.`);
    }

    const team = await getTeamByJoinCode(joinCode);
    if (!team) throw new Error('No team found for that join code.');

    // Enforce 5-member maximum limit before account creation
    const existingPlayers = await listPlayersByTeam(team.id);
    if (existingPlayers.length >= MAX_TEAM_MEMBERS) {
      throw new Error(`Cannot join team: Team "${team.name}" already has reached the maximum allowed limit of ${MAX_TEAM_MEMBERS} members (excluding the coach).`);
    }

    await signUpAndSignIn(email, password);
    const player = await createPlayer({ teamId: team.id, displayName, email, isCaptain: false });
    await createUser({ email, displayName, role: 'player', playerId: player.id, teamId: team.id, coachId: null });
    setUser({ email, displayName, role: 'player', playerId: player.id, teamId: team.id, coachId: null });
    return { team, player };
  }, []);

  // Coach registers — gets their own coachId and manages teams from /coach.
  const registerCoach = useCallback(async ({ email, password, displayName }) => {
    // Item 4: Registration cutoff check
    if (!isRegistrationOpen()) {
      throw new Error(`Registration closed on ${getRegistrationDeadlineText()}. New registrations are no longer accepted.`);
    }

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
