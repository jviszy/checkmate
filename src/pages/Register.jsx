import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Users, UserCog, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button, Card } from '../components/ui.jsx';
import { KingGlyph } from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { STATES, zoneOfState } from '../lib/zones.js';

export default function Register() {
  const { registerCaptain, registerMember, registerCoach, confirmRegistration } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('captain'); // 'captain' | 'member' | 'coach'
  const [form, setForm] = useState({
    displayName: '', email: '', password: '', teamName: '', joinCode: '', state: '', code: ''
  });
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'captain') {
        if (!form.state) throw new Error('Please select your state.');
        const { isSignUpComplete, nextStep } = await registerCaptain({
          email: form.email.trim(), password: form.password,
          displayName: form.displayName.trim(), teamName: form.teamName.trim(), state: form.state,
        });
        if (nextStep?.signUpStep === 'CONFIRM_SIGN_UP') setConfirming(true);
        else if (isSignUpComplete) {
           const res = await confirmRegistration(form.email.trim(), ''); // Auto-confirmed
           setDone(res);
        }
      } else if (mode === 'member') {
        const { isSignUpComplete, nextStep } = await registerMember({
          email: form.email.trim(), password: form.password,
          displayName: form.displayName.trim(), joinCode: form.joinCode.trim(),
        });
        if (nextStep?.signUpStep === 'CONFIRM_SIGN_UP') setConfirming(true);
        else if (isSignUpComplete) {
           const res = await confirmRegistration(form.email.trim(), '');
           setDone(res);
        }
      } else {
        const { isSignUpComplete, nextStep } = await registerCoach({
          email: form.email.trim(), password: form.password,
          displayName: form.displayName.trim(),
        });
        if (nextStep?.signUpStep === 'CONFIRM_SIGN_UP') setConfirming(true);
        else if (isSignUpComplete) {
           const res = await confirmRegistration(form.email.trim(), '');
           setDone(res);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitConfirm = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await confirmRegistration(form.email.trim(), form.code.trim());
      setDone(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
        <h1 className="mt-5 text-3xl font-semibold text-white">You're registered!</h1>
        {done.kind === 'captain' ? (
          <>
            <p className="mt-3 text-gray-300">
              Team <span className="font-semibold text-brandred-400">{done.teamName}</span> is
              <span className="text-brandred-400"> live</span> and ready to play.
            </p>
            <Card className="mx-auto mt-6 max-w-xs p-5">
              <p className="text-sm text-gray-400">Share this join code with your teammates:</p>
              <p className="mt-2 font-mono text-2xl font-bold tracking-widest text-brandred-400">{done.joinCode}</p>
            </Card>
          </>
        ) : done.kind === 'member' ? (
          <p className="mt-3 text-gray-300">
            You've joined <span className="font-semibold text-brandred-400">{done.teamName}</span>.
            You're all set — head to your dashboard.
          </p>
        ) : (
          <p className="mt-3 text-gray-300">
            Your <span className="font-semibold text-brandred-400">coach account</span> is ready.
            Create and manage your teams from your coach dashboard.
          </p>
        )}
        <Button to={done.kind === 'coach' ? '/coach' : '/dashboard'} className="mt-8">
          {done.kind === 'coach' ? 'Go to my teams' : 'Go to your dashboard'}
        </Button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="mb-8 text-center">
          <KingGlyph className="mx-auto h-12 w-12" />
          <h1 className="mt-4 text-3xl font-semibold text-white">Check your email</h1>
          <p className="mt-2 text-gray-400">We sent a 6-digit verification code to {form.email}</p>
        </div>
        <Card className="p-7">
          <form onSubmit={submitConfirm} className="space-y-4">
            <Field label="Verification Code" value={form.code} onChange={set('code')} required autoFocus placeholder="123456" />
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-brandred-500/10 px-3 py-2 text-sm text-brandred-400">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            <Button as="button" type="submit" className="w-full" disabled={busy}>
              {busy ? 'Verifying...' : 'Verify and continue'}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="mb-8 text-center">
        <KingGlyph className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-3xl font-semibold text-white">Join Checkmate</h1>
        <p className="mt-2 text-gray-400">Create a new team or join an existing one.</p>
      </div>

      {/* Mode toggle */}
      <div className="mb-6 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-board-900 p-1">
        <ToggleBtn active={mode === 'captain'} onClick={() => setMode('captain')} icon={Users}>
          Create team
        </ToggleBtn>
        <ToggleBtn active={mode === 'member'} onClick={() => setMode('member')} icon={UserPlus}>
          Join team
        </ToggleBtn>
        <ToggleBtn active={mode === 'coach'} onClick={() => setMode('coach')} icon={UserCog}>
          Coach
        </ToggleBtn>
      </div>

      <Card className="p-7">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Your full name" value={form.displayName} onChange={set('displayName')} required autoFocus />
          <Field label="Email" type="email" value={form.email} onChange={set('email')} required />
          <Field label="Password" type="password" value={form.password} onChange={set('password')} required minLength={6} />

          {mode === 'captain' && (
            <>
              <Field label="Team name" value={form.teamName} onChange={set('teamName')} required placeholder="e.g. Royal Knights" />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-300">State</span>
                <select
                  value={form.state} onChange={(e) => set('state')(e.target.value)} required
                  className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2.5 text-white outline-none focus:border-brandred-500"
                >
                  <option value="">Select your state…</option>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {form.state && (
                  <span className="mt-1 block text-xs text-brandred-400">Zone: {zoneOfState(form.state)}</span>
                )}
              </label>
            </>
          )}
          {mode === 'member' && (
            <Field label="Team join code" value={form.joinCode} onChange={set('joinCode')} required placeholder="6-character code" />
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-brandred-500/10 px-3 py-2 text-sm text-brandred-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <Button as="button" type="submit" className="w-full" disabled={busy}>
            {busy ? 'Submitting…' : mode === 'captain' ? 'Register team' : mode === 'member' ? 'Join team' : 'Create coach account'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-400">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-brandred-400 hover:text-brandred-300">Sign in</Link>
        </p>
      </Card>

      <p className="mt-4 text-center text-xs text-gray-500">
        {mode === 'captain'
          ? 'As captain you’ll get a join code to invite teammates. Your team goes live right away.'
          : mode === 'member'
          ? 'Ask your team captain for the join code they received at registration.'
          : 'Coaches create and manage multiple teams from a single dashboard.'}
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
        active ? 'bg-brandred-500 text-board-950' : 'text-gray-400 hover:text-white'
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
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2.5 text-white placeholder-gray-500 outline-none transition-colors focus:border-brandred-500 focus:ring-1 focus:ring-brandred-500"
        {...rest}
      />
    </label>
  );
}
