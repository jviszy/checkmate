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
        title="Zone Standings & Nationals Qualification"
        subtitle={
          leaderboard.length < 200
            ? `Under 200 team registrations (${leaderboard.length} registered) — every registered team advances to the Nationals.`
            : `200+ team registrations (${leaderboard.length} registered) — exactly 100 teams qualify for the Nationals, distributed across zones based on performance.`
        }
        className="mb-10"
      />

      {/* Nationals Qualification Rule Indicator Card */}
      <Card className="mb-8 p-5 border-brandred-500/30 bg-board-900/80">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-semibold text-white">Nationals Qualification Rule: </span>
            {leaderboard.length < 200 ? (
              <span className="text-gray-300">
                Under 200 registered teams (<strong className="text-white">{leaderboard.length}</strong> total) — <strong className="text-emerald-400">every registered team advances</strong>.
              </span>
            ) : (
              <span className="text-gray-300">
                200 or more registered teams (<strong className="text-white">{leaderboard.length}</strong> total) — <strong className="text-brandred-400">top 100 teams qualify</strong> distributed across zones based on performance.
              </span>
            )}
          </div>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-mono text-xs font-bold text-emerald-400">
            {advancing} Qualifiers
          </span>
        </div>
      </Card>

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
              advanceCount={rows.filter((r) => r.advancing || r.nationalsQualified).length}
            />
          </div>
        ))}
      </div>

      <Card className="mt-8 p-5 text-sm text-gray-400">
        <span className="font-medium text-brandred-400">Competition & Qualification Rules:</span> Every team requires
        exactly 1 coach and 2 to 5 members (coach counted separately). Scores are calculated per team by summing all members' individual points.
        For Nationals qualification: If total registrations are under 200, all registered teams advance; if 200 or more, exactly 100 teams qualify,
        distributed across zones based on performance deterministically.
      </Card>
    </div>
  );
}
