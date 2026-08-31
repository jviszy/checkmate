import { defineAuth } from '@aws-amplify/backend';
import { preSignUp } from './pre-sign-up/resource';

/**
 * Cognito auth for Checkmate.
 *
 * - Email-based sign-up/sign-in for every player (each member has their own account).
 * - A pre-sign-up trigger auto-confirms accounts, so registration is frictionless
 *   (no email verification code).
 * - An "Admins" group for Coderina organizers. Membership drives access to the
 *   admin panel and full write access in the data layer.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['Admins'],
  triggers: {
    preSignUp,
  },
});
