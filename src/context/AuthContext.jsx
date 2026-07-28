import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { signUp, signIn as amplifySignIn, signOut as amplifySignOut, getCurrentUser, fetchAuthSession, confirmSignUp } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { createPlayer, createTeam, getTeamByJoinCode, createUserProfile, getUserProfile } from '../lib/api.js';

const client = generateClient();
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const { tokens } = await fetchAuthSession();
      if (!tokens) throw new Error("No session");
      const currentUser = await getCurrentUser();
      
      const p = await getUserProfile(currentUser.signInDetails.loginId);
      
      if (p) {
        setUser({
          email: p.email,
          displayName: p.displayName,
          role: p.role,
          playerId: p.playerId,
          teamId: p.teamId,
          coachId: p.coachId
        });
      } else {
        setUser({ email: currentUser.signInDetails.loginId, role: 'player' });
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const signIn = useCallback(async (email, password) => {
    await amplifySignIn({ username: email, password });
    await fetchSession();
    return user; 
  }, [fetchSession, user]);
  
  const registerCaptain = useCallback(async ({ email, password, displayName, teamName, state }) => {
    const { isSignUpComplete, nextStep } = await signUp({
      username: email,
      password,
      options: { userAttributes: { preferred_username: displayName } }
    });
    localStorage.setItem('pendingRegistration', JSON.stringify({
      mode: 'captain', email, displayName, teamName, state, password
    }));
    return { isSignUpComplete, nextStep };
  }, []);

  const registerMember = useCallback(async ({ email, password, displayName, joinCode }) => {
    const { isSignUpComplete, nextStep } = await signUp({
      username: email, password,
      options: { userAttributes: { preferred_username: displayName } }
    });
    localStorage.setItem('pendingRegistration', JSON.stringify({
      mode: 'member', email, displayName, joinCode, password
    }));
    return { isSignUpComplete, nextStep };
  }, []);

  const registerCoach = useCallback(async ({ email, password, displayName }) => {
    const { isSignUpComplete, nextStep } = await signUp({
      username: email, password,
      options: { userAttributes: { preferred_username: displayName } }
    });
    localStorage.setItem('pendingRegistration', JSON.stringify({
      mode: 'coach', email, displayName, password
    }));
    return { isSignUpComplete, nextStep };
  }, []);

  const confirmRegistration = useCallback(async (email, code) => {
    await confirmSignUp({ username: email, confirmationCode: code });
    const pending = JSON.parse(localStorage.getItem('pendingRegistration') || '{}');
    
    // Auto login
    await amplifySignIn({ username: email, password: pending.password });
    
    // Create DB records
    let profile = { email, displayName: pending.displayName, role: pending.mode === 'coach' ? 'coach' : 'player' };
    let result = { kind: pending.mode };

    if (pending.mode === 'captain') {
      const team = await createTeam({ name: pending.teamName, state: pending.state });
      const player = await createPlayer({ teamId: team.id, displayName: pending.displayName, email, isCaptain: true });
      profile.teamId = team.id;
      profile.playerId = player.id;
      result.teamName = team.name;
      result.joinCode = team.joinCode;
    } else if (pending.mode === 'member') {
      const team = await getTeamByJoinCode(pending.joinCode);
      if (!team) throw new Error("Team not found");
      const player = await createPlayer({ teamId: team.id, displayName: pending.displayName, email, isCaptain: false });
      profile.teamId = team.id;
      profile.playerId = player.id;
      result.teamName = team.name;
    } else if (pending.mode === 'coach') {
      profile.coachId = `coach_${Math.random().toString(36).slice(2, 9)}`;
    }

    await createUserProfile(profile);
    localStorage.removeItem('pendingRegistration');
    await fetchSession();
    return result;
  }, [fetchSession]);

  const signOut = useCallback(async () => {
    await amplifySignOut();
    setUser(null);
  }, []);

  const value = {
    user, loading,
    role: user?.role || null,
    isAdmin: user?.role === 'admin',
    isCoach: user?.role === 'coach',
    isAuthed: !!user,
    signIn, registerCaptain, registerMember, registerCoach, confirmRegistration, signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
