import type { PreSignUpTriggerHandler } from 'aws-lambda';

/**
 * Auto-confirm every sign-up so players can register and start using the site
 * immediately — no email verification code to enter. Frictionless registration
 * is a product requirement for the Checkmate launch.
 */
// Item 4 (server-side enforcement): registration closes Thursday 12/11/2026 at
// 18:00 Africa/Lagos (WAT, UTC+01:00). Compared in epoch time on the server.
const REGISTRATION_DEADLINE_MS = Date.parse('2026-11-12T18:00:00+01:00');

export const handler: PreSignUpTriggerHandler = async (event) => {
  // Only block brand-new email/password sign-ups. External-provider sign-ins
  // (Google / social) also pass through PreSignUp and must keep working.
  if (event.triggerSource === 'PreSignUp_SignUp' && Date.now() > REGISTRATION_DEADLINE_MS) {
    throw new Error('Registration closed on Thursday 12/11/2026 at 18:00 (WAT). New registrations are no longer accepted.');
  }
  event.response.autoConfirmUser = true;
  if (event.request.userAttributes.email) {
    event.response.autoVerifyEmail = true;
  }
  return event;
};
