// ─────────────────────────────────────────────────────────────────────────
// Password Reset Service (logged-out flow, email/password accounts only)
//
// Cognito is the source of truth: requesting a reset makes Cognito email the
// account a 6-digit verification code, and the new password is set with that
// code. This works across devices and browsers, and never reveals whether an
// email exists in the system.
// ─────────────────────────────────────────────────────────────────────────

import {
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
} from 'aws-amplify/auth';

/**
 * Request a password reset without being logged in.
 * Cognito emails a time-limited verification code to the account.
 * ALWAYS returns the same generic message regardless of whether the email exists.
 */
export async function requestPasswordReset(rawEmail) {
  const email = (rawEmail || '').trim().toLowerCase();
  const genericSuccessMessage =
    'If an account with this email address exists, a verification code has been sent to your inbox.';

  if (!email) {
    return { success: true, message: genericSuccessMessage };
  }

  try {
    await amplifyResetPassword({ username: email });
  } catch (err) {
    // Intentionally suppressed: never reveal whether the email exists or why
    // the provider rejected the request.
    console.debug('[Password Reset] request outcome:', err?.name || err?.message);
  }

  return { success: true, message: genericSuccessMessage, email };
}

/**
 * Set a new password using the emailed verification code.
 */
export async function resetPasswordWithCode({ email, code, newPassword }) {
  const username = (email || '').trim().toLowerCase();
  if (!username) {
    throw new Error('Enter your account email address.');
  }
  if (!code || !code.trim()) {
    throw new Error('Enter the verification code from your email.');
  }
  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters.');
  }

  try {
    await amplifyConfirmResetPassword({
      username,
      confirmationCode: code.trim(),
      newPassword,
    });
  } catch (err) {
    if (err?.name === 'CodeMismatchException') {
      throw new Error('That verification code is not correct. Check the most recent email you received.');
    }
    if (err?.name === 'ExpiredCodeException') {
      throw new Error('That verification code has expired. Request a new one from the Forgot password page.');
    }
    if (err?.name === 'LimitExceededException') {
      throw new Error('Too many attempts. Please wait a few minutes and try again.');
    }
    if (err?.name === 'InvalidPasswordException') {
      throw new Error('Password does not meet the requirements: use at least 8 characters.');
    }
    throw new Error(err?.message || 'Could not reset the password. Request a new code and try again.');
  }

  return {
    success: true,
    message: 'Your password has been reset. You can now sign in with your new password.',
  };
}
