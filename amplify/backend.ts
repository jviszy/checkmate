import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

/**
 * Checkmate backend.
 * Run `npx ampx sandbox` (with AWS credentials configured) to stand up a
 * personal cloud backend and generate `amplify_outputs.json` for the frontend.
 */
const backend = defineBackend({
  auth,
  data,
});

// Relax the Cognito password policy for a school event: an 8-character minimum,
// but no forced upper/lower/number/symbol mix — easier for young registrants.
const { cfnUserPool } = backend.auth.resources.cfnResources;
cfnUserPool.policies = {
  passwordPolicy: {
    minimumLength: 8,
    requireLowercase: false,
    requireNumbers: false,
    requireUppercase: false,
    requireSymbols: false,
  },
};
