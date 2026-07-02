import { useState, useMemo } from 'react';
import { CalendarClock, History } from 'lucide-react';
import { SectionTitle, Card } from '../components/ui.jsx';
import MatchCard from '../components/MatchCard.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';

export default function Matches() {
  const { matches, teams, tournament } = useCheckmate();
  const rounds = useMemo(
    () => [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b),
    [matches]
  );
  const [round, setRound] = useState('all');

  const filtered = round === 'all' ? matches : matches.filter((m) => m.round === Number(round));
  const upcoming = filtered
    .filter((m) => m.status !== 'completed')
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const previous = filtered
    .filter((m) => m.status === 'completed')
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionTitle
        eyebrow={`${tournament?.name || 'Checkmate'} · Schedule`}
        title="Matches"
        subtitle="Automatically generated fixtures — see what's next and how previous games finished."
        className="mb-8"
      />

      {/* Round filter */}
      <div className="mb-10 flex flex-wrap gap-2">
        <FilterChip active={round === 'all'} onClick={() => setRound('all')}>All rounds</FilterChip>
        {rounds.map((r) => (
          <FilterChip key={r} active={round === String(r)} onClick={() => setRound(String(r))}>
            Round {r}
          </FilterChip>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <CalendarClock className="h-5 w-5 text-brandred-500" /> Upcoming
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300">{upcoming.length}</span>
          </h3>
          <div className="space-y-4">
            {upcoming.length ? (
              upcoming.map((m) => <MatchCard key={m.id} match={m} teams={teams} />)
            ) : (
              <Card className="p-6 text-center text-sm text-gray-400">No upcoming matches.</Card>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <History className="h-5 w-5 text-emerald-400" /> Previous
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300">{previous.length}</span>
          </h3>
          <div className="space-y-4">
            {previous.length ? (
              previous.map((m) => <MatchCard key={m.id} match={m} teams={teams} />)
            ) : (
              <Card className="p-6 text-center text-sm text-gray-400">No completed matches yet.</Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-brandred-500 bg-brandred-500/15 text-brandred-300'
          : 'border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
