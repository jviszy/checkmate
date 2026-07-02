import { motion } from 'framer-motion';
import { Crown, Minus } from 'lucide-react';
import { TeamMark, StatusPill } from './ui.jsx';
import { fmtScore } from '../lib/format.js';

/**
 * Ranked team table. Rows where `advancing` is true (top N) are highlighted as
 * the teams that proceed to the next round.
 */
export default function LeaderboardTable({ rows, advanceCount = 6, compact = false }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-board-800/60 p-10 text-center text-gray-400">
        No active teams yet. Approved teams will appear here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-board-800 text-xs uppercase tracking-wide text-gray-400">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Team</th>
            {!compact && <th className="px-4 py-3 text-center font-medium">Players</th>}
            <th className="px-4 py-3 text-right font-medium">Score</th>
            {!compact && <th className="px-4 py-3 text-center font-medium">Status</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <motion.tr
              key={t.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.4) }}
              className={`border-t border-white/5 ${
                t.advancing ? 'bg-brandred-500/[0.06]' : 'bg-board-900/40'
              } hover:bg-white/[0.04]`}
            >
              <td className="px-4 py-3">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    t.rank === 1 ? 'bg-brandred-500 text-board-950'
                      : t.advancing ? 'bg-brandred-500/20 text-brandred-300'
                      : 'bg-white/5 text-gray-400'
                  }`}
                >
                  {t.rank}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <TeamMark name={t.name} logoUrl={t.logoUrl} size={compact ? 32 : 38} />
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-white">
                      {t.name}
                      {t.rank === 1 && <Crown className="h-4 w-4 text-brandred-400" />}
                    </div>
                    {t.advancing && (
                      <span className="text-xs text-brandred-500">Advancing</span>
                    )}
                  </div>
                </div>
              </td>
              {!compact && (
                <td className="px-4 py-3 text-center text-gray-400">{t.memberCount}</td>
              )}
              <td className="px-4 py-3 text-right">
                <span className="font-mono text-lg font-semibold text-white">{fmtScore(t.total)}</span>
              </td>
              {!compact && (
                <td className="px-4 py-3 text-center">
                  <StatusPill status={t.status} />
                </td>
              )}
            </motion.tr>
          ))}
        </tbody>
      </table>
      {rows.length > advanceCount && (
        <div className="flex items-center gap-2 border-t border-dashed border-brandred-500/30 bg-board-900 px-4 py-2 text-xs text-brandred-500">
          <Minus className="h-3 w-3" /> Top {advanceCount} teams advance to the next round
        </div>
      )}
    </div>
  );
}
