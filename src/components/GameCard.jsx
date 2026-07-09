import { Link } from 'react-router-dom';
import { Play, Eye, Circle } from 'lucide-react';
import { TeamMark, StatusPill } from './ui.jsx';
import { teamById } from '../lib/format.js';

/**
 * A single playable board game. Links through to the live board at /play/:id.
 * `canPlay` shows a "Play" affordance; otherwise it's "Watch"/"View".
 */
export default function GameCard({ game, teams, players, canPlay = false }) {
  const white = teamById(teams, game.whiteTeamId);
  const black = teamById(teams, game.blackTeamId);
  const wName = players?.find((p) => p.id === game.whitePlayerId)?.displayName;
  const bName = players?.find((p) => p.id === game.blackPlayerId)?.displayName;
  const live = game.status === 'live';
  const done = game.status === 'completed';

  const Side = ({ team, name, isWinner }) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <TeamMark name={team?.name || '?'} logoUrl={team?.logoUrl} size={30} />
        <div className="leading-tight">
          <div className={`text-sm font-medium ${isWinner ? 'text-brandred-300' : 'text-white'}`}>{name || 'TBD'}</div>
          <div className="text-xs text-gray-500">{team?.name}</div>
        </div>
      </div>
      {isWinner && <span className="text-xs font-semibold text-brandred-400">W</span>}
    </div>
  );

  return (
    <div className={`rounded-xl border p-4 ${live ? 'border-brandred-500/40 bg-brandred-500/[0.05]' : 'border-white/10 bg-board-800/60'}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Round {game.round}</span>
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brandred-500/40 bg-brandred-500/15 px-2.5 py-0.5 text-xs font-medium text-brandred-400">
            <Circle className="h-1.5 w-1.5 animate-pulse fill-brandred-400 text-brandred-400" /> Live
          </span>
        ) : (
          <StatusPill status={game.status} />
        )}
      </div>

      <div className="space-y-2">
        <Side team={white} name={wName} isWinner={done && game.result === 'white'} />
        <Side team={black} name={bName} isWinner={done && game.result === 'black'} />
      </div>

      <div className="mt-3 border-t border-white/5 pt-3">
        <Link to={`/play/${game.id}`}>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brandred-400 hover:text-brandred-300">
            {done ? <><Eye className="h-4 w-4" /> View game</> : canPlay ? <><Play className="h-4 w-4" /> Play</> : <><Eye className="h-4 w-4" /> Watch live</>}
          </span>
        </Link>
      </div>
    </div>
  );
}
