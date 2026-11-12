import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button, Card } from '../components/ui.jsx';
import { KingGlyph } from '../components/Logo.jsx';
import { requestPasswordReset } from '../lib/passwordReset.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Unable to process request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <div className="mb-8 text-center">
        <KingGlyph className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-3xl font-semibold text-white">Reset password</h1>
        <p className="mt-2 text-sm text-gray-400">
          Enter your account email to receive a time-limited verification code.
        </p>
      </div>

      <Card className="p-7">
        {submitted ? (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Check your email</h2>
              <p className="mt-2 text-sm text-gray-300">
                If an email/password account exists for <span className="font-semibold text-white">{email}</span>, a verification code has been sent to that inbox.
              </p>
              <p className="mt-3 text-xs text-gray-400">
                The code expires shortly. Be sure to check your spam or junk folder if it does not appear in your inbox.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <Button to={`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`} className="w-full">
                I have my code — set new password
              </Button>
              <Button to="/login" variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-300">Account email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/10 bg-board-900 px-3 py-2.5 text-white placeholder-gray-500 outline-none transition-colors focus:border-brandred-500 focus:ring-1 focus:ring-brandred-500"
              />
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-brandred-500/10 px-3 py-2 text-sm text-brandred-400">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <Button as="button" type="submit" className="w-full" disabled={busy}>
              <Mail className="h-4 w-4" /> {busy ? 'Sending code…' : 'Send verification code'}
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
