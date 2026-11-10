import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { KeyRound, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button, Card, PasswordInput } from '../components/ui.jsx';
import { KingGlyph } from '../components/Logo.jsx';
import { verifyResetToken, completePasswordReset } from '../lib/passwordReset.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [tokenStatus, setTokenStatus] = useState({ checked: false, valid: false, email: '', error: '' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenStatus({
        checked: true,
        valid: false,
        email: '',
        error: 'No reset token provided. Please request a new link from the forgot password page.',
      });
      return;
    }

    const check = verifyResetToken(token);
    setTokenStatus({
      checked: true,
      valid: check.valid,
      email: check.email || '',
      error: check.error || '',
    });
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await completePasswordReset({
        token,
        newPassword,
        confirmationCode: confirmationCode.trim() || undefined,
      });
      setDone(true);
      setTimeout(() => navigate('/login'), 4000);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <div className="mb-8 text-center">
        <KingGlyph className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-3xl font-semibold text-white">Create new password</h1>
        <p className="mt-2 text-sm text-gray-400">
          {tokenStatus.email ? `Setting new password for ${tokenStatus.email}` : 'Enter your new account password'}
        </p>
      </div>

      <Card className="p-7">
        {!tokenStatus.checked ? (
          <div className="py-6 text-center text-sm text-gray-400">Validating reset link…</div>
        ) : !tokenStatus.valid ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brandred-500/10 text-brandred-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Reset Link Invalid or Expired</h2>
              <p className="mt-2 text-sm text-gray-300">{tokenStatus.error}</p>
            </div>
            <div className="pt-2">
              <Button to="/forgot-password" className="w-full">
                Request a new reset link
              </Button>
            </div>
          </div>
        ) : done ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Password Updated</h2>
              <p className="mt-2 text-sm text-gray-300">
                Your new password is now active. Redirecting you to the sign-in page…
              </p>
            </div>
            <div className="pt-2">
              <Button to="/login" className="w-full">
                Sign in now
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-300">New password</span>
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                required
                minLength={8}
                autoFocus
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-300">Confirm new password</span>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
                minLength={8}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">
                Cognito Verification Code (optional, if received via SMS or email code)
              </span>
              <input
                type="text"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                placeholder="e.g. 123456"
                className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brandred-500"
              />
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-brandred-500/10 px-3 py-2 text-sm text-brandred-400">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <Button as="button" type="submit" className="w-full" disabled={busy}>
              <KeyRound className="h-4 w-4" /> {busy ? 'Updating password…' : 'Update password'}
            </Button>

            <div className="pt-2 text-center">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
