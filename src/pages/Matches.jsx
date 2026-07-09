import { useState, useMemo } from 'react';
import { Radio, CalendarClock, History } from 'lucide-react';
import { SectionTitle, Card } from '../components/ui.jsx';
import GameCard from '../components/GameCard.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Matches() {
  const { games, teams, players, tournament } = useCheckmate();
  const { user } = useAuth();
  const rounds = useMemo(
    () => [...new Set(games.map((g) => g.round))].sort((a, b) => a - b),
    [games]
  );
  const [round, setRound] = useState('all');

  const scoped = round === 'all' ? games : games.filter((g) => g.round === Number(round));
  const live = scoped.filter((g) => g.status === 'live');
  const upcoming = scoped.filter((g) => g.status === 'scheduled');
  const done = scoped.filter((g) => g.status === 'completed')
    .sort((a, b) => new Date(b.endedAt || 0) - new Date(a.endedAt || 0));

  // Can this user play a given game? (their team is in it, or they're admin/coach)
  const canPlay = (g) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'coach') return [g.whiteTeamId, g.blackTeamId].some((tid) => teams.find((t) => t.id === tid)?.coachId === user.coachId);
    return user.playerId === g.whitePlayerId || user.playerId === g.blackPlayerId;
  };

  const empty = games.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionTitle
        eyebrow={`${tournament?.name || 'Checkmate'} · Games`}
        title="Matches"
        subtitle="Chess games are played right here on the board. Watch live, or play your own."
        className="mb-8"
      />

      {empty ? (
        <Card className="p-12 text-center text-gray-400">
          No games yet. Once teams register and organizers start the round, live boards appear here.
        </Card>
      ) : (
        <>
          {/* Round filter */}
          {rounds.length > 1 && (
            <div className="mb-10 flex flex-wrap gap-2">
              <FilterChip active={round === 'all'} onClick={() => setRound('all')}>All rounds</FilterChip>
              {rounds.map((r) => (
                <FilterChip key={r} active={round === String(r)} onClick={() => setRound(String(r))}>Round {r}</FilterChip>
              ))}
            </div>
          )}

          {/* Live now */}
          {live.length > 0 && (
            <section className="mb-12">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <Radio className="h-5 w-5 text-brandred-400" /> Live now
                <span className="rounded-full bg-brandred-500/20 px-2 py-0.5 text-xs text-brandred-300">{live.length}</span>
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {live.map((g) => <GameCard key={g.id} game={g} teams={teams} players={players} canPlay={canPlay(g)} />)}
              </div>
            </section>
          )}

          <div className="grid gap-10 lg:grid-cols-2">
            <section>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <CalendarClock className="h-5 w-5 text-brandred-500" /> Upcoming
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300">{upcoming.length}</span>
              </h3>
              <div className="space-y-4">
                {upcoming.length ? upcoming.map((g) => <GameCard key={g.id} game={g} teams={teams} players={players} canPlay={canPlay(g)} />)
                  : <Card className="p-6 text-center text-sm text-gray-400">No upcoming games.</Card>}
              </div>
            </section>

            <section>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <History className="h-5 w-5 text-emerald-400" /> Results
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300">{done.length}</span>
              </h3>
              <div className="space-y-4">
                {done.length ? done.map((g) => <GameCard key={g.id} game={g} teams={teams} players={players} />)
                  : <Card className="p-6 text-center text-sm text-gray-400">No completed games yet.</Card>}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-brandred-500 bg-brandred-500/15 text-brandred-300'
          : 'border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
