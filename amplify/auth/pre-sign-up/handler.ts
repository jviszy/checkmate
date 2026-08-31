import type { PreSignUpTriggerHandler } from 'aws-lambda';

/**
 * Auto-confirm every sign-up so players can register and start using the site
 * immediately — no email verification code to enter. Frictionless registration
 * is a product requirement for the Checkmate launch.
 */
export const handler: PreSignUpTriggerHandler = async (event) => {
  event.response.autoConfirmUser = true;
  if (event.request.userAttributes.email) {
    event.response.autoVerifyEmail = true;
  }
  return event;
};
