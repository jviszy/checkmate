import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus, Users, UserCog, AlertCircle, CheckCircle2,
  Plus, Trash2, Sparkles, User, Award,
} from 'lucide-react';
import { Button, Card, PasswordInput } from '../components/ui.jsx';
import { KingGlyph } from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { STATES, zoneOfState } from '../lib/zones.js';
import { MIN_TEAM_MEMBERS, MAX_TEAM_MEMBERS } from '../lib/api.js';

export default function Register() {
  const { registerCaptain, registerMember, registerCoach } = useAuth();
  const [mode, setMode] = useState('captain'); // 'captain' | 'member' | 'coach'

  // Captain + Team registration state
  const [teamName, setTeamName] = useState('');
  const [state, setState] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [captainEmail, setCaptainEmail] = useState('');
  const [captainPassword, setCaptainPassword] = useState('');

  // Coach information (required, exactly 1, counted separately from members)
  const [coachName, setCoachName] = useState('');
  const [coachEmail, setCoachEmail] = useState('');
  const [coachPhone, setCoachPhone] = useState('');

  // Team roster: Member 2 is required (to meet minimum 2 members); additional members up to 5 total
  const [member2, setMember2] = useState({ name: '', email: '' });
  const [extraMembers, setExtraMembers] = useState([]); // array of { name: '', email: '' }

  // Join existing team state
  const [joinForm, setJoinForm] = useState({ displayName: '', email: '', password: '', joinCode: '' });

  // Coach account registration state
  const [coachForm, setCoachForm] = useState({ displayName: '', email: '', password: '' });

  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  // Total member count (Captain + Member 2 + Extra members). Coach is counted separately!
  const totalMemberCount = 1 + (member2.name.trim() || member2.email.trim() ? 1 : 1) + extraMembers.length;

  const handleAddMember = () => {
    if (totalMemberCount >= MAX_TEAM_MEMBERS) {
      setError(`Teams cannot exceed a maximum of ${MAX_TEAM_MEMBERS} members (excluding the coach).`);
      return;
    }
    setError('');
    setExtraMembers([...extraMembers, { name: '', email: '' }]);
  };

  const handleRemoveExtraMember = (index) => {
    setError('');
    setExtraMembers(extraMembers.filter((_, i) => i !== index));
  };

  const handleUpdateExtraMember = (index, field, val) => {
    const updated = [...extraMembers];
    updated[index][field] = val;
    setExtraMembers(updated);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      if (mode === 'captain') {
        // ── Front-end form validation ───────────────────────────────────────
        if (!teamName.trim()) throw new Error('Please enter a team name.');
        if (!state) throw new Error('Please select your state.');

        // 1. Coach validation: Exactly 1 coach required, counted separately
        if (!coachName.trim()) {
          throw new Error('Every team registration requires exactly one coach. Please enter the coach\'s full name.');
        }
        if (!coachEmail.trim()) {
          throw new Error('Every team registration requires exactly one coach. Please enter the coach\'s email address.');
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(coachEmail.trim())) {
          throw new Error('Please enter a valid email address for the coach.');
        }

        // 2. Member validation: Minimum 2 members, Maximum 5 members
        if (!captainName.trim()) throw new Error('Team captain full name is required.');
        if (!captainEmail.trim() || !emailRegex.test(captainEmail.trim())) {
          throw new Error('Please enter a valid email address for the team captain.');
        }
        if (!captainPassword || captainPassword.length < 6) {
          throw new Error('Captain account password must be at least 6 characters.');
        }

        if (!member2.name.trim() || !member2.email.trim()) {
          throw new Error('Teams must have a minimum of 2 members, plus exactly one coach. Please provide details for Member 2.');
        }
        if (!emailRegex.test(member2.email.trim())) {
          throw new Error('Please enter a valid email address for Member 2.');
        }

        const validExtraMembers = [];
        for (let i = 0; i < extraMembers.length; i++) {
          const em = extraMembers[i];
          const mNum = i + 3;
          if (!em.name.trim() || !em.email.trim()) {
            throw new Error(`Please fill in both name and email for Member ${mNum}, or remove the entry.`);
          }
          if (!emailRegex.test(em.email.trim())) {
            throw new Error(`Please enter a valid email address for Member ${mNum}.`);
          }
          validExtraMembers.push({ displayName: em.name.trim(), email: em.email.trim().toLowerCase() });
        }

        const allMemberCount = 1 + 1 + validExtraMembers.length;
        if (allMemberCount < MIN_TEAM_MEMBERS) {
          throw new Error(`Teams must have a minimum of ${MIN_TEAM_MEMBERS} members (excluding the coach). Currently: ${allMemberCount}.`);
        }
        if (allMemberCount > MAX_TEAM_MEMBERS) {
          throw new Error(`Teams cannot exceed a maximum of ${MAX_TEAM_MEMBERS} members (excluding the coach). Currently: ${allMemberCount}.`);
        }

        // Duplicate email check
        const allEmails = [
          coachEmail.trim().toLowerCase(),
          captainEmail.trim().toLowerCase(),
          member2.email.trim().toLowerCase(),
          ...validExtraMembers.map((m) => m.email),
        ];
        const uniqueEmails = new Set(allEmails);
        if (uniqueEmails.size !== allEmails.length) {
          throw new Error('Each team member and coach must have a unique email address.');
        }

        const additionalMembers = [
          { displayName: member2.name.trim(), email: member2.email.trim().toLowerCase() },
          ...validExtraMembers,
        ];

        const { team } = await registerCaptain({
          email: captainEmail.trim().toLowerCase(),
          password: captainPassword,
          displayName: captainName.trim(),
          teamName: teamName.trim(),
          state,
          coachName: coachName.trim(),
          coachEmail: coachEmail.trim().toLowerCase(),
          coachPhone: coachPhone.trim(),
          additionalMembers,
        });

        setDone({
          kind: 'captain',
          teamName: team.name,
          joinCode: team.joinCode,
          coachName: coachName.trim(),
          memberCount: allMemberCount,
        });
      } else if (mode === 'member') {
        if (!joinForm.displayName.trim()) throw new Error('Please enter your full name.');
        if (!joinForm.email.trim()) throw new Error('Please enter your email.');
        if (!joinForm.password || joinForm.password.length < 6) throw new Error('Password must be at least 6 characters.');
        if (!joinForm.joinCode.trim()) throw new Error('Please enter your team\'s 6-character join code.');

        const { team } = await registerMember({
          email: joinForm.email.trim().toLowerCase(),
          password: joinForm.password,
          displayName: joinForm.displayName.trim(),
          joinCode: joinForm.joinCode.trim().toUpperCase(),
        });
        setDone({ kind: 'member', teamName: team.name });
      } else {
        if (!coachForm.displayName.trim()) throw new Error('Please enter your full name.');
        if (!coachForm.email.trim()) throw new Error('Please enter your email.');
        if (!coachForm.password || coachForm.password.length < 6) throw new Error('Password must be at least 6 characters.');

        await registerCoach({
          email: coachForm.email.trim().toLowerCase(),
          password: coachForm.password,
          displayName: coachForm.displayName.trim(),
        });
        setDone({ kind: 'coach' });
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400" />
        <h1 className="mt-5 text-3xl font-bold text-white">Registration Successful!</h1>
        {done.kind === 'captain' ? (
          <>
            <p className="mt-3 text-gray-300">
              Team <span className="font-semibold text-brandred-400">{done.teamName}</span> is registered with
              {' '}<span className="font-semibold text-white">{done.memberCount} members</span> and coach
              {' '}<span className="font-semibold text-white">{done.coachName}</span>.
            </p>
            <Card className="mx-auto mt-6 max-w-xs p-5">
              <p className="text-xs uppercase tracking-wider text-gray-400">Team Join Code</p>
              <p className="mt-2 font-mono text-2xl font-bold tracking-widest text-brandred-400">{done.joinCode}</p>
            </Card>

            {/* Practice Demo Callout */}
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-brandred-500/30 bg-brandred-500/10 p-4 text-left">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brandred-400" />
                <div>
                  <h4 className="text-sm font-semibold text-white">Try the Live Match Demo</h4>
                  <p className="mt-1 text-xs text-gray-300">
                    See how real-time chess matches, 10-minute clocks, and move suggestions work in our safe sandbox.
                  </p>
                  <Button to="/demo" size="sm" variant="outline" className="mt-3">
                    Launch Match Demo
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : done.kind === 'member' ? (
          <p className="mt-3 text-gray-300">
            You have joined <span className="font-semibold text-brandred-400">{done.teamName}</span>.
            You're all set to compete!
          </p>
        ) : (
          <p className="mt-3 text-gray-300">
            Your coach account is active. Manage your teams and players from your coach dashboard.
          </p>
        )}
        <div className="mt-8 flex justify-center gap-3">
          <Button to={done.kind === 'coach' ? '/coach' : '/dashboard'}>
            {done.kind === 'coach' ? 'Go to my teams' : 'Go to dashboard'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      {/* Live Match Demo Callout Banner (Easy to find from registration area) */}
      <div className="mb-8 rounded-2xl border border-brandred-500/40 bg-gradient-to-r from-brandred-950/60 via-board-900 to-board-950 p-4 shadow-md sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brandred-500/20 p-2 text-brandred-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brandred-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brandred-400">
                  Interactive Demo
                </span>
                <span className="text-xs text-gray-400">Safe, Non-Competitive Sandbox</span>
              </div>
              <h3 className="text-sm font-semibold text-white">Want to see how live matches work?</h3>
              <p className="text-xs text-gray-300">
                Practice with real-time chessboards, 10-minute clocks, and hints without affecting tournament rankings.
              </p>
            </div>
          </div>
          <Button to="/demo" size="sm" variant="outline" className="shrink-0">
            Launch Match Demo
          </Button>
        </div>
      </div>

      <div className="mb-8 text-center">
        <KingGlyph className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-3xl font-semibold text-white">Team Registration</h1>
        <p className="mt-2 text-sm text-gray-400">
          Teams must have <span className="font-semibold text-white">2 to 5 members</span> plus
          {' '}<span className="font-semibold text-brandred-400">exactly one coach</span> (counted separately).
        </p>
      </div>

      {/* Mode toggle */}
      <div className="mb-6 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-board-900 p-1">
        <ToggleBtn active={mode === 'captain'} onClick={() => { setMode('captain'); setError(''); }} icon={Users}>
          Create team
        </ToggleBtn>
        <ToggleBtn active={mode === 'member'} onClick={() => { setMode('member'); setError(''); }} icon={UserPlus}>
          Join team
        </ToggleBtn>
        <ToggleBtn active={mode === 'coach'} onClick={() => { setMode('coach'); setError(''); }} icon={UserCog}>
          Coach account
        </ToggleBtn>
      </div>

      <Card className="p-7">
        <form onSubmit={submit} className="space-y-6">
          {mode === 'captain' && (
            <>
              {/* Team Information */}
              <div className="space-y-4">
                <h3 className="border-b border-white/10 pb-2 text-sm font-semibold uppercase tracking-wider text-brandred-400">
                  1. Team Details
                </h3>
                <Field
                  label="Team name"
                  value={teamName}
                  onChange={setTeamName}
                  required
                  placeholder="e.g. Royal Knights"
                  autoFocus
                />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-gray-300">State</span>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    required
                    className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2.5 text-white outline-none focus:border-brandred-500"
                  >
                    <option value="">Select your state…</option>
                    {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {state && (
                    <span className="mt-1 block text-xs text-brandred-400">Zone: {zoneOfState(state)}</span>
                  )}
                </label>
              </div>

              {/* Coach Information (Required, exactly one, counted separately) */}
              <div className="space-y-4 rounded-xl border border-brandred-500/20 bg-brandred-500/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <UserCog className="h-4 w-4 text-brandred-400" /> 2. Team Coach
                    <span className="rounded-full bg-brandred-500/20 px-2 py-0.5 text-[11px] font-bold text-brandred-400">
                      Required · 1 Coach
                    </span>
                  </h3>
                  <span className="text-[11px] text-gray-400">Counted separately from members</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Coach full name"
                    value={coachName}
                    onChange={setCoachName}
                    required
                    placeholder="e.g. Dr. Ngozi Okafor"
                  />
                  <Field
                    label="Coach email"
                    type="email"
                    value={coachEmail}
                    onChange={setCoachEmail}
                    required
                    placeholder="coach@example.com"
                  />
                </div>
                <Field
                  label="Coach phone number (optional)"
                  type="tel"
                  value={coachPhone}
                  onChange={setCoachPhone}
                  placeholder="+234 800 000 0000"
                />
              </div>

              {/* Members Roster (2 to 5 members required) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-brandred-400">
                      3. Team Members Roster
                    </h3>
                    <p className="text-xs text-gray-400">
                      Minimum 2 members, maximum 5 members (coach is counted separately).
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 font-mono text-xs font-bold ${
                      totalMemberCount >= MIN_TEAM_MEMBERS && totalMemberCount <= MAX_TEAM_MEMBERS
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-brandred-500/20 text-brandred-400'
                    }`}
                  >
                    {totalMemberCount} / {MAX_TEAM_MEMBERS} members
                  </span>
                </div>

                {/* Member 1: Captain (Account login credentials) */}
                <div className="rounded-xl border border-white/10 bg-board-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <Award className="h-3.5 w-3.5 text-brandred-400" /> Member 1 (Captain · Account Login)
                    </span>
                    <span className="rounded bg-brandred-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-brandred-400">
                      Captain
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Captain full name" value={captainName} onChange={setCaptainName} required />
                    <Field label="Captain email" type="email" value={captainEmail} onChange={setCaptainEmail} required />
                  </div>
                  <Field
                    label="Account password (for captain sign-in)"
                    type="password"
                    value={captainPassword}
                    onChange={setCaptainPassword}
                    required
                    minLength={6}
                  />
                </div>

                {/* Member 2: Required to satisfy minimum 2 members */}
                <div className="rounded-xl border border-white/10 bg-board-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <User className="h-3.5 w-3.5 text-gray-400" /> Member 2
                    </span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300">
                      Required for minimum size
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Member 2 full name"
                      value={member2.name}
                      onChange={(v) => setMember2({ ...member2, name: v })}
                      required
                    />
                    <Field
                      label="Member 2 email"
                      type="email"
                      value={member2.email}
                      onChange={(v) => setMember2({ ...member2, email: v })}
                      required
                    />
                  </div>
                </div>

                {/* Additional Members 3, 4, 5 */}
                {extraMembers.map((em, idx) => (
                  <div key={idx} className="rounded-xl border border-white/10 bg-board-900/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <User className="h-3.5 w-3.5 text-gray-400" /> Member {idx + 3}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraMember(idx)}
                        className="flex items-center gap-1 text-xs text-brandred-400 hover:text-brandred-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label={`Member ${idx + 3} full name`}
                        value={em.name}
                        onChange={(v) => handleUpdateExtraMember(idx, 'name', v)}
                        required
                      />
                      <Field
                        label={`Member ${idx + 3} email`}
                        type="email"
                        value={em.email}
                        onChange={(v) => handleUpdateExtraMember(idx, 'email', v)}
                        required
                      />
                    </div>
                  </div>
                ))}

                {/* Add member button */}
                {totalMemberCount < MAX_TEAM_MEMBERS ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddMember}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4" /> Add another member ({totalMemberCount}/{MAX_TEAM_MEMBERS})
                  </Button>
                ) : (
                  <p className="text-center text-xs text-gray-500">
                    Maximum team size of {MAX_TEAM_MEMBERS} members reached (excluding the coach).
                  </p>
                )}
              </div>
            </>
          )}

          {mode === 'member' && (
            <>
              <Field
                label="Your full name"
                value={joinForm.displayName}
                onChange={(v) => setJoinForm({ ...joinForm, displayName: v })}
                required
                autoFocus
              />
              <Field
                label="Email"
                type="email"
                value={joinForm.email}
                onChange={(v) => setJoinForm({ ...joinForm, email: v })}
                required
              />
              <Field
                label="Password"
                type="password"
                value={joinForm.password}
                onChange={(v) => setJoinForm({ ...joinForm, password: v })}
                required
                minLength={6}
              />
              <Field
                label="Team join code"
                value={joinForm.joinCode}
                onChange={(v) => setJoinForm({ ...joinForm, joinCode: v })}
                required
                placeholder="6-character code"
              />
              <p className="text-xs text-gray-400">
                Note: Teams have a maximum cap of 5 members. If the team is full, you cannot join.
              </p>
            </>
          )}

          {mode === 'coach' && (
            <>
              <Field
                label="Your full name"
                value={coachForm.displayName}
                onChange={(v) => setCoachForm({ ...coachForm, displayName: v })}
                required
                autoFocus
              />
              <Field
                label="Email"
                type="email"
                value={coachForm.email}
                onChange={(v) => setCoachForm({ ...coachForm, email: v })}
                required
              />
              <Field
                label="Password"
                type="password"
                value={coachForm.password}
                onChange={(v) => setCoachForm({ ...coachForm, password: v })}
                required
                minLength={6}
              />
              <p className="text-xs text-gray-400">
                Coaches manage their team rosters, oversee live matches, and guide players.
              </p>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-brandred-500/10 px-3.5 py-2.5 text-sm font-medium text-brandred-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button as="button" type="submit" className="w-full" disabled={busy}>
            {busy ? 'Registering team…' : mode === 'captain' ? 'Register team' : mode === 'member' ? 'Join team' : 'Create coach account'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-400">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-brandred-400 hover:text-brandred-300">Sign in</Link>
        </p>
      </Card>

      <p className="mt-4 text-center text-xs text-gray-500">
        Checkmate competition rule: Teams require exactly 1 coach and 2 to 5 members. All team scores roll up toward qualification.
      </p>
    </div>
  );
}

function ToggleBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
        active ? 'bg-brandred-500 text-board-950 font-semibold' : 'text-gray-400 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

function Field({ label, type = 'text', value, onChange, ...rest }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-300">{label}</span>
      {type === 'password' ? (
        <PasswordInput value={value} onChange={onChange} {...rest} />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2.5 text-white placeholder-gray-500 outline-none transition-colors focus:border-brandred-500 focus:ring-1 focus:ring-brandred-500"
          {...rest}
        />
      )}
    </label>
  );
}
