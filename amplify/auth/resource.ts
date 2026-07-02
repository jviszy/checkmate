import { defineAuth } from '@aws-amplify/backend';

/**
 * Cognito auth for Checkmate.
 *
 * - Email-based sign-up/sign-in for every player (each member has their own account).
 * - An "Admins" group for Coderina organizers. Add organizer accounts to this
 *   group in the Cognito console (or via the AWS CLI) — membership drives access
 *   to the admin panel and write access in the data layer below.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['Admins'],
  userAttributes: {
    preferredUsername: { required: false, mutable: true },
  },
});
