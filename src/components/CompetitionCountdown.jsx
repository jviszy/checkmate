import { useEffect, useState } from 'react';
import { Clock, Radio, Lock } from 'lucide-react';
import {
  getCompetitionPhase,
  msUntilCompetitionStart,
  msUntilCompetitionEnd,
  COMPETITION_WINDOW,
} from '../lib/tournamentConfig.js';
import { serverNow } from '../lib/timeSync.js';

function fmtCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  if (hours > 0) return `${hours}:${pad(mins)}:${pad(secs)}`;
  return `${mins}:${pad(secs)}`;
}

/**
 * Live competition-window banner.
 * - Before 10:00 WAT on 13/11/2026: counts down to the boards opening.
 * - 10:00–10:45: shows LIVE with a countdown to close.
 * - After 10:45: shows the competition as closed.
 */
export default function CompetitionCountdown({ className = '' }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  void now; // ticker dependency — the real time comes from serverNow()
  const nowDate = serverNow();
  const phase = getCompetitionPhase(nowDate);
  const { START_TIME, END_TIME } = COMPETITION_WINDOW;

  if (phase === 'before') {
    return (
      <div className={`flex flex-col gap-2 rounded-xl border border-gold-500/30 bg-gradient-to-r from-board-900 via-board-950 to-board-900 p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/10 p-2 text-gray-200"><Clock className="h-5 w-5" /></div>
          <div>
            <div className="text-sm font-semibold text-white">Competition starts soon</div>
            <div className="text-xs text-gray-400">Boards open Friday 13/11/2026 at {START_TIME} (WAT) and close at {END_TIME} (WAT).</div>
          </div>
        </div>
        <div className="font-mono text-2xl font-bold tabular-nums text-white">
          {fmtCountdown(msUntilCompetitionStart(nowDate))}
        </div>
      </div>
    );
  }

  if (phase === 'open') {
    return (
      <div className={`flex flex-col gap-2 rounded-xl border border-brandred-500/50 bg-brandred-500/10 p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brandred-500/20 p-2 text-brandred-400"><Radio className="h-5 w-5 animate-pulse" /></div>
          <div>
            <div className="text-sm font-semibold text-white">Competition is LIVE — boards are open</div>
            <div className="text-xs text-gray-300">All games close at {END_TIME} (WAT). Finish your moves before the clock runs out.</div>
          </div>
        </div>
        <div className="font-mono text-2xl font-bold tabular-nums text-brandred-300">
          {fmtCountdown(msUntilCompetitionEnd(nowDate))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 rounded-xl border border-white/10 bg-board-900/80 p-4 ${className}`}>
      <div className="rounded-lg bg-white/10 p-2 text-gray-400"><Lock className="h-5 w-5" /></div>
      <div>
        <div className="text-sm font-semibold text-white">Competition closed</div>
        <div className="text-xs text-gray-400">Play ended Friday 13/11/2026 at {COMPETITION_WINDOW.END_TIME} (WAT). Boards are locked — results are final.</div>
      </div>
    </div>
  );
}
