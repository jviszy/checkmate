import { useState } from 'react';
import { KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { updatePassword } from 'aws-amplify/auth';
import { Button, Card } from '../components/ui.jsx';
import { KingGlyph } from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Account() {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setDone(false);
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (newPassword !== confirm) return setError('New passwords do not match.');
    setBusy(true);
    try {
      await updatePassword({ oldPassword, newPassword });
      setDone(true);
      setOldPassword(''); setNewPassword(''); setConfirm('');
    } catch (err) {
      if (err?.name === 'NotAuthorizedException') setError('Your current password is incorrect.');
      else if (err?.name === 'InvalidPasswordException') setError('New password must be at least 8 characters.');
      else if (err?.name === 'LimitExceededException') setError('Too many attempts. Please try again later.');
      else setError(err.message || 'Could not change password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <div className="mb-8 text-center">
        <KingGlyph className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-3xl font-semibold text-white">Change password</h1>
        <p className="mt-2 text-gray-400">Signed in as {user?.email}</p>
      </div>

      <Card className="p-7">
        {done && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Password updated. Use it next time you sign in.
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Current password" value={oldPassword} onChange={setOldPassword} required autoFocus autoComplete="current-password" />
          <Field label="New password" value={newPassword} onChange={setNewPassword} required minLength={8} autoComplete="new-password" />
          <Field label="Confirm new password" value={confirm} onChange={setConfirm} required minLength={8} autoComplete="new-password" />

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-brandred-500/10 px-3 py-2 text-sm text-brandred-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <Button as="button" type="submit" className="w-full" disabled={busy}>
            <KeyRound className="h-4 w-4" /> {busy ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-xs text-gray-500">
        Passwords must be at least 8 characters.
      </p>
    </div>
  );
}

function Field({ label, value, onChange, ...rest }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-300">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2.5 text-white placeholder-gray-500 outline-none transition-colors focus:border-brandred-500 focus:ring-1 focus:ring-brandred-500"
        {...rest}
      />
    </label>
  );
}
