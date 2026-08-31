// ─────────────────────────────────────────────────────────────────────────
// Amplify bootstrap. Imported once, before anything else that talks to the
// backend, so `Amplify.configure` runs before any generateClient()/Auth call.
// ─────────────────────────────────────────────────────────────────────────
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from '../../amplify_outputs.json';

Amplify.configure(outputs);

// One shared data client for the whole app.
export const client = generateClient();
