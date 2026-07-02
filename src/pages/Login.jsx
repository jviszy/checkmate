import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LogIn, AlertCircle, Info } from 'lucide-react';
import { Button, Card } from '../components/ui.jsx';
import { KingGlyph } from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dest = location.state?.from || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const session = await signIn(email.trim(), password);
      navigate(session.isAdmin && dest === '/dashboard' ? '/admin' : dest);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <div className="mb-8 text-center">
        <KingGlyph className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-3xl font-semibold text-white">Welcome back</h1>
        <p className="mt-2 text-gray-400">Sign in to your Checkmate dashboard.</p>
      </div>

      <Card className="p-7">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} required autoFocus />
          <Field label="Password" type="password" value={password} onChange={setPassword} required />

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-brandred-500/10 px-3 py-2 text-sm text-brandred-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <Button as="button" type="submit" className="w-full" disabled={busy}>
            <LogIn className="h-4 w-4" /> {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-400">
          No account yet?{' '}
          <Link to="/register" className="font-medium text-brandred-400 hover:text-brandred-300">Register a team</Link>
        </p>
      </Card>

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-white/10 bg-board-800/50 p-4 text-xs text-gray-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brandred-500" />
        <div>
          <span className="font-medium text-gray-300">Demo accounts</span>
          <div className="mt-1">Admin — <code className="text-brandred-400">admin@coderina.org</code> / <code className="text-brandred-400">admin123</code></div>
          <div>Player — <code className="text-brandred-400">adaokeke@example.com</code> / <code className="text-brandred-400">player123</code></div>
        </div>
      </div>
    </div>
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
