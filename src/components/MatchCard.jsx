import { Calendar, Clock } from 'lucide-react';
import { TeamMark, StatusPill } from './ui.jsx';
import { fmtDate, fmtTime, fmtScore, teamById } from '../lib/format.js';

/**
 * A single fixture. Shows both teams, the scheduled time, and — for completed
 * matches — the score with the winner highlighted.
 */
export default function MatchCard({ match, teams, highlightTeamId }) {
  const a = teamById(teams, match.teamAId);
  const b = teamById(teams, match.teamBId);
  const done = match.status === 'completed';
  const aWon = done && match.scoreA > match.scoreB;
  const bWon = done && match.scoreB > match.scoreA;

  const Side = ({ team, won, score }) => (
    <div className={`flex items-center gap-3 ${won ? 'text-white' : 'text-gray-300'}`}>
      <TeamMark name={team?.name || '?'} logoUrl={team?.logoUrl} size={36} />
      <span className={`text-sm font-medium ${highlightTeamId && team?.id === highlightTeamId ? 'text-brandred-400' : ''}`}>
        {team?.name || 'TBD'}
      </span>
      {won && <span className="text-xs font-semibold text-brandred-500">W</span>}
    </div>
  );

  return (
    <div className="rounded-xl border border-white/10 bg-board-800/60 p-4 transition-colors hover:border-brandred-500/30">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Round {match.round}
        </span>
        <StatusPill status={match.status} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Side team={a} won={aWon} />
          {done && <span className={`font-mono text-lg font-bold ${aWon ? 'text-brandred-400' : 'text-gray-400'}`}>{fmtScore(match.scoreA)}</span>}
        </div>
        <div className="flex items-center justify-between">
          <Side team={b} won={bWon} />
          {done && <span className={`font-mono text-lg font-bold ${bWon ? 'text-brandred-400' : 'text-gray-400'}`}>{fmtScore(match.scoreB)}</span>}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-white/5 pt-3 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDate(match.scheduledAt)}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmtTime(match.scheduledAt)}</span>
      </div>
    </div>
  );
}
