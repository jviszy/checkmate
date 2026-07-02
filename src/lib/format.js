export function fmtDate(iso) {
  if (!iso) return 'TBD';
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function fmtScore(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function teamName(teams, id) {
  return teams.find((t) => t.id === id)?.name || 'Unknown';
}

export function teamById(teams, id) {
  return teams.find((t) => t.id === id) || null;
}
