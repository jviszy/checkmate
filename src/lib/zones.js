// Nigeria's six geopolitical zones and their states.
// Teams are grouped into a zone automatically from the state they register with.

export const STATES_BY_ZONE = {
  'North Central': ['Benue', 'FCT (Abuja)', 'Kogi', 'Kwara', 'Nasarawa', 'Niger', 'Plateau'],
  'North East': ['Adamawa', 'Bauchi', 'Borno', 'Gombe', 'Taraba', 'Yobe'],
  'North West': ['Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Sokoto', 'Zamfara'],
  'South East': ['Abia', 'Anambra', 'Ebonyi', 'Enugu', 'Imo'],
  'South South': ['Akwa Ibom', 'Bayelsa', 'Cross River', 'Delta', 'Edo', 'Rivers'],
  'South West': ['Ekiti', 'Lagos', 'Ogun', 'Ondo', 'Osun', 'Oyo'],
};

export const ZONES = Object.keys(STATES_BY_ZONE);

export const STATES = Object.values(STATES_BY_ZONE).flat().sort((a, b) => a.localeCompare(b));

const STATE_TO_ZONE = {};
for (const [zone, states] of Object.entries(STATES_BY_ZONE)) {
  for (const s of states) STATE_TO_ZONE[s] = zone;
}

export const UNZONED = 'Unzoned';

/** Zone for a given state name. */
export function zoneOfState(state) {
  return STATE_TO_ZONE[state] || UNZONED;
}

/** Zone for a team (from its `state`; falls back to an explicit `zone`). */
export function zoneOfTeam(team) {
  if (!team) return UNZONED;
  if (team.state && STATE_TO_ZONE[team.state]) return STATE_TO_ZONE[team.state];
  return team.zone || UNZONED;
}

/** Short label for compact display, e.g. "North Central" → "NC". */
export function zoneAbbr(zone) {
  return (zone || '').split(' ').map((w) => w[0]).join('').toUpperCase() || '—';
}
