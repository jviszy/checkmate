import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

/**
 * Checkmate backend.
 * Run `npx ampx sandbox` (with AWS credentials configured) to stand up a
 * personal cloud backend and generate `amplify_outputs.json` for the frontend.
 */
defineBackend({
  auth,
  data,
});
