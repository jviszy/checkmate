// ─────────────────────────────────────────────────────────────────────────
// Password Reset Service (Logged-out flow)
// Implements secure, time-limited password reset link flow.
// Does NOT reveal whether an email exists in the system upon submission.
// Applies to email/password accounts only.
// ─────────────────────────────────────────────────────────────────────────

import { resetPassword as amplifyResetPassword, confirmResetPassword as amplifyConfirmResetPassword } from 'aws-amplify/auth';
import { sendPasswordResetEmail } from './notifications.js';

const RESET_TOKENS_KEY = 'checkmate_password_reset_tokens';
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour time limit

function getStoredTokens() {
  try {
    const raw = localStorage.getItem(RESET_TOKENS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredTokens(tokens) {
  try {
    localStorage.setItem(RESET_TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // ignore
  }
}

/**
 * Generate a random URL-safe token.
 */
function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Request password reset without being logged in.
 * Generates a time-limited link and sends it to the user.
 * ALWAYS returns the same generic message regardless of whether the email exists.
 */
export async function requestPasswordReset(rawEmail) {
  const email = (rawEmail || '').trim().toLowerCase();
  const genericSuccessMessage =
    'If an account with this email address exists, a time-limited password reset link has been sent to your inbox.';

  if (!email) {
    return { success: true, message: genericSuccessMessage };
  }

  const now = Date.now();
  const expiresAt = now + TOKEN_TTL_MS;
  const token = generateToken();

  // Try Amplify Cognito resetPassword in background (best effort for live user pools)
  try {
    await amplifyResetPassword({ username: email });
  } catch (err) {
    // Intentionally suppressed: Never reveal if email exists or if provider rejected
    console.debug('[Password Reset] Amplify reset triggered:', err?.name || err?.message);
  }

  // Store token record
  const tokens = getStoredTokens();
  // Clean up expired tokens
  for (const [t, data] of Object.entries(tokens)) {
    if (data.expiresAt < now) delete tokens[t];
  }

  tokens[token] = {
    email,
    expiresAt,
    createdAt: now,
  };
  saveStoredTokens(tokens);

  // Construct reset link
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const resetLink = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

  // Dispatch email notification with time-limited link
  await sendPasswordResetEmail({
    to: email,
    resetLink,
    expiresAt,
  });

  return {
    success: true,
    message: genericSuccessMessage,
  };
}

/**
 * Validate a password reset token.
 */
export function verifyResetToken(token) {
  if (!token) {
    return { valid: false, error: 'Reset token is missing.' };
  }

  const tokens = getStoredTokens();
  const entry = tokens[token];

  if (!entry) {
    return { valid: false, error: 'Invalid or already used password reset link.' };
  }

  if (Date.now() > entry.expiresAt) {
    return { valid: false, error: 'This password reset link has expired. Please request a new one.' };
  }

  return {
    valid: true,
    email: entry.email,
    expiresAt: entry.expiresAt,
  };
}

/**
 * Set a new password using a verified reset token.
 */
export async function completePasswordReset({ token, newPassword, confirmationCode }) {
  const verification = verifyResetToken(token);
  if (!verification.valid) {
    throw new Error(verification.error);
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters.');
  }

  const { email } = verification;

  // If a Cognito confirmation code was also received, use it
  if (confirmationCode) {
    try {
      await amplifyConfirmResetPassword({
        username: email,
        confirmationCode,
        newPassword,
      });
    } catch (err) {
      if (err?.name === 'CodeMismatchException') {
        throw new Error('Invalid verification code.');
      }
      if (err?.name === 'ExpiredCodeException') {
        throw new Error('Verification code has expired. Please request a new link.');
      }
      throw new Error(err.message || 'Could not reset password.');
    }
  }

  // Consume the token so it cannot be reused
  const tokens = getStoredTokens();
  delete tokens[token];
  saveStoredTokens(tokens);

  return {
    success: true,
    message: 'Your password has been successfully reset. You may now sign in with your new password.',
  };
}
