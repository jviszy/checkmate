import { Clock, MapPin } from 'lucide-react';
import { SectionTitle, Card, Button } from '../components/ui.jsx';
import LeaderboardTable from '../components/LeaderboardTable.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import { groupByZone, totalAdvancing } from '../lib/scoring.js';

export default function Leaderboard() {
  const { leaderboard, leaderboardLive, winnersPerZone, tournament } = useCheckmate();

  // Before the first game is played the leaderboard isn't public yet.
  if (!leaderboardLive) {
    return (
      <div className="mx-auto max-w-xl px-4 py-28 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brandred-500/15">
          <Clock className="h-8 w-8 text-brandred-400" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-white">The leaderboard isn’t live yet</h1>
        <p className="mt-3 text-gray-400">
          Zone standings open automatically once the first game of the competition is played.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button to="/matches" variant="outline">View the schedule</Button>
          <Button to="/register">Register your team</Button>
        </div>
      </div>
    );
  }

  const zones = groupByZone(leaderboard);
  const advancing = totalAdvancing(leaderboard, winnersPerZone);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <SectionTitle
        eyebrow={`${tournament?.name || 'Checkmate'} · Round ${tournament?.currentRound ?? 1}`}
        title="Zone standings"
        subtitle={`Teams compete within their geopolitical zone. The top ${winnersPerZone} of each zone advance — ${advancing} team${advancing !== 1 ? 's' : ''} across ${zones.length} zone${zones.length !== 1 ? 's' : ''}.`}
        className="mb-10"
      />

      <div className="space-y-10">
        {zones.map(({ zone, rows }) => (
          <div key={zone}>
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-brandred-400" />
              <h2 className="text-xl font-semibold text-white">{zone}</h2>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-gray-300">
                {rows.length} team{rows.length !== 1 ? 's' : ''}
              </span>
            </div>
            {/* Show zone rank in the table by mapping rank → zoneRank */}
            <LeaderboardTable
              rows={rows.map((r) => ({ ...r, rank: r.zoneRank }))}
              advanceCount={winnersPerZone}
            />
          </div>
        ))}
      </div>

      <Card className="mt-8 p-5 text-sm text-gray-400">
        <span className="font-medium text-brandred-400">How it works:</span> each team’s score is the total
        of its members’ points. Teams are grouped into their state’s geopolitical zone and only play within
        that zone. The top {winnersPerZone} of every zone advance to the next round.
      </Card>
    </div>
  );
}
