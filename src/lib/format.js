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
  if (id === 'bot_team') return 'Bot Opponents';
  return teams.find((t) => t.id === id)?.name || 'Unknown';
}

export function teamById(teams, id) {
  if (id === 'bot_team') {
    return { id: 'bot_team', name: 'Bot Opponents', state: 'Automated', logoUrl: '' };
  }
  return teams.find((t) => t.id === id) || null;
}

export function playerName(players, id) {
  if (!id) return 'TBD';
  if (id.startsWith('bot_player') || id === 'bot_opponent') {
    return 'Checkmate Bot';
  }
  return players.find((p) => p.id === id)?.displayName || 'TBD';
}

