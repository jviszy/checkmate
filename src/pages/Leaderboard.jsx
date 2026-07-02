import { motion } from 'framer-motion';
import { Trophy, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionTitle, Card, Button } from '../components/ui.jsx';
import LeaderboardTable from '../components/LeaderboardTable.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import { fmtScore } from '../lib/format.js';

export default function Leaderboard() {
  const { leaderboard, leaderboardLive, tournament } = useCheckmate();
  const advanceCount = tournament?.advanceCount ?? 6;
  const podium = leaderboard.slice(0, 3);

  // Before the first match is played the leaderboard isn't public yet.
  if (!leaderboardLive) {
    return (
      <div className="mx-auto max-w-xl px-4 py-28 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brandred-500/15">
          <Clock className="h-8 w-8 text-brandred-400" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-white">The leaderboard isn’t live yet</h1>
        <p className="mt-3 text-gray-400">
          Standings open automatically once the first match of the competition has been played.
          Teams are registering now — check the schedule for upcoming fixtures.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button to="/matches" variant="outline">View the schedule</Button>
          <Button to="/register">Register your team</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <SectionTitle
        eyebrow={`${tournament?.name || 'Checkmate'} · Round ${tournament?.currentRound ?? 1}`}
        title="Leaderboard"
        subtitle="Team scores are the sum of every member's points. The top teams advance."
        className="mb-10"
      />

      {/* Podium */}
      {podium.length === 3 && (
        <div className="mb-10 grid grid-cols-3 gap-3 sm:gap-5">
          {[podium[1], podium[0], podium[2]].map((t) => {
            const place = t.rank;
            const heights = { 1: 'h-32', 2: 'h-24', 3: 'h-20' };
            const colors = {
              1: 'from-brandred-400 to-brandred-600 text-board-950',
              2: 'from-gray-300 to-gray-500 text-board-950',
              3: 'from-brandred-700/80 to-board-600 text-white',
            };
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: place * 0.1 }}
                className="flex flex-col items-center justify-end"
              >
                <div className="mb-2 text-center">
                  <div className="font-medium text-white">{t.name}</div>
                  <div className="font-mono text-sm text-brandred-400">{fmtScore(t.total)} pts</div>
                </div>
                <div className={`flex w-full flex-col items-center justify-start rounded-t-xl bg-gradient-to-b ${colors[place]} ${heights[place]} pt-3`}>
                  {place === 1 && <Trophy className="h-6 w-6" />}
                  <span className="mt-1 text-2xl font-bold">{place}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <LeaderboardTable rows={leaderboard} advanceCount={advanceCount} />

      <Card className="mt-6 p-5 text-sm text-gray-400">
        <span className="font-medium text-brandred-400">How scoring works:</span> each team's score is the
        total of all its members' individual points. Highlighted rows are the top {advanceCount} teams
        currently in position to advance to the next round.
      </Card>
    </div>
  );
}
