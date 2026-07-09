import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Trophy, Users, CalendarClock, ListChecks, ArrowRight, Crown, ShieldCheck,
} from 'lucide-react';
import { Brain, Smile, GitBranch, Timer } from 'lucide-react';
import { Button, Card, SectionTitle } from '../components/ui.jsx';
import { KingGlyph, FullLogo } from '../components/Logo.jsx';
import LeaderboardTable from '../components/LeaderboardTable.jsx';
import MatchCard from '../components/MatchCard.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import heroPhoto from '../assets/photos/hero.jpg';
import boardPhoto from '../assets/photos/board.jpg';
import g1 from '../assets/photos/g1.jpg';
import g2 from '../assets/photos/g2.jpg';
import g3 from '../assets/photos/g3.jpg';
import g4 from '../assets/photos/g4.jpg';

/** Photo tile with a gradient scrim and caption, used in the impact gallery. */
function GalleryImg({ src, caption, className = '' }) {
  return (
    <figure className={`group relative overflow-hidden rounded-2xl border border-white/10 ${className}`}>
      <img
        src={src}
        alt={caption}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-board-950 via-board-950/30 to-transparent" />
      <figcaption className="absolute inset-x-0 bottom-0 p-4 font-serif text-lg font-semibold text-white">
        {caption}
      </figcaption>
    </figure>
  );
}

// The four pillars from Coderina's Checkmate brand graphics.
const pillars = [
  { icon: Brain, label: 'Critical Thinking', color: 'text-pillarred', ring: 'border-pillarred/40 bg-pillarred/10' },
  { icon: Smile, label: 'Confidence', color: 'text-pillarblue', ring: 'border-pillarblue/40 bg-pillarblue/10' },
  { icon: GitBranch, label: 'Decision Making', color: 'text-pillargreen', ring: 'border-pillargreen/40 bg-pillargreen/10' },
  { icon: Timer, label: 'Discipline', color: 'text-pillargold', ring: 'border-pillargold/40 bg-pillargold/10' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08 } }),
};

const steps = [
  { icon: Users, title: 'Register your team', text: 'Sign up your squad. The captain creates the team; teammates join with a code.' },
  { icon: ShieldCheck, title: 'Get approved', text: 'Organizers review and approve registrations to keep the bracket clean.' },
  { icon: CalendarClock, title: 'Play your matches', text: 'Fixtures are generated automatically. Track your next and previous games.' },
  { icon: Crown, title: 'Top 6 advance', text: 'Every member’s score adds to the team total. The top 6 teams proceed.' },
];

export default function Landing() {
  const { teams, players, matches, leaderboard, leaderboardLive, tournament } = useCheckmate();

  const advanceCount = tournament?.advanceCount ?? 6;
  const topTeams = leaderboard.slice(0, 5);
  const upcoming = matches
    .filter((m) => m.status !== 'completed')
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, 3);

  const activeCount = teams.filter((t) => t.status === 'active' || t.status === 'advanced').length;
  const completedCount = matches.filter((m) => m.status === 'completed').length;

  const stats = [
    { label: 'Teams competing', value: activeCount, icon: Users },
    { label: 'Players', value: players.length, icon: Trophy },
    { label: 'Matches played', value: completedCount, icon: ListChecks },
    { label: 'Teams advancing', value: advanceCount, icon: Crown },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-board-grid">
        {/* Photographic backdrop with a dark scrim so text stays readable */}
        <div className="absolute inset-0">
          <img src={heroPhoto} alt="" aria-hidden="true" className="h-full w-full object-cover object-center opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-board-950/80 via-board-950/92 to-board-950" />
          <div className="absolute inset-0 bg-gradient-to-r from-board-950/70 via-transparent to-board-950/70" />
        </div>
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brandred-500/25 blur-[120px]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
          <motion.div
            initial="hidden" animate="show" variants={fadeUp}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-brandred-500/30 bg-brandred-500/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-brandred-400">
              Coderina presents
            </span>
            <FullLogo className="mx-auto mt-8 h-44 w-auto drop-shadow-[0_10px_40px_rgba(228,0,20,0.45)] sm:h-56" />
            <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-white sm:text-5xl">
              Empowering Minds Through <br className="hidden sm:block" />the <span className="text-gradient-gold">Game of Kings</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-gray-200">
              The Coderina team chess competition. Register your squad, climb the leaderboard, and
              battle through the rounds — where every member’s move counts toward the team.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Button to="/register" size="lg">Register your team <ArrowRight className="h-4 w-4" /></Button>
              <Button to={leaderboardLive ? '/leaderboard' : '/matches'} size="lg" variant="outline">
                {leaderboardLive ? 'View leaderboard' : 'View the schedule'}
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s, i) => (
              <motion.div key={s.label} custom={i} initial="hidden" animate="show" variants={fadeUp}>
                <Card className="p-5 text-center">
                  <s.icon className="mx-auto h-6 w-6 text-brandred-500" />
                  <div className="mt-2 font-mono text-3xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-gray-400">{s.label}</div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* More than just a game — the four pillars */}
      <section className="border-y border-white/10 bg-board-900/60">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-brandred-400">
            More than just a game
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-2xl font-semibold text-white sm:text-3xl">
            Checkmate helps young minds think smarter, dream bigger, and act wiser
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {pillars.map((p, i) => (
              <motion.div
                key={p.label} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
              >
                <div className={`flex h-full flex-col items-center gap-3 rounded-2xl border ${p.ring} p-6 text-center`}>
                  <p.icon className={`h-8 w-8 ${p.color}`} />
                  <span className="font-semibold text-white">{p.label}</span>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
            Powered by passion · driven by purpose
          </p>
        </div>
      </section>

      {/* Impact gallery */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionTitle
          center
          eyebrow="On the board"
          title="Where champions are made"
          subtitle="Chess builds strategy, resilience, and confidence — one move at a time."
          className="mb-10"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          <GalleryImg src={g2} caption="Focus, strategy, resilience" className="sm:col-span-2 lg:col-span-2 lg:row-span-2 min-h-[280px]" />
          <GalleryImg src={g1} caption="Every move sharpens the mind" className="min-h-[200px]" />
          <GalleryImg src={g3} caption="One board, countless lessons" className="min-h-[200px]" />
          <GalleryImg src={g4} caption="Big thinkers start with small moves" className="sm:col-span-2 min-h-[200px]" />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionTitle
          center
          eyebrow="How it works"
          title="From registration to checkmate"
          subtitle="A clear path through the competition for every team."
          className="mb-12"
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.title} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
            >
              <Card className="h-full p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brandred-500/15 text-brandred-400">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{s.text}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Scoring rule highlight */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <Card className="relative overflow-hidden bg-board-grid p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brandred-500/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brandred-400">The team scoring rule</span>
            <h2 className="mt-3 text-3xl font-semibold text-white">Scores count by team, not by player</h2>
            <p className="mt-4 text-gray-300">
              Every team member’s points are added together into one team score. There are no
              individual rankings to chase — your squad rises or falls together. When a round ends,
              the <span className="font-semibold text-brandred-400">top {advanceCount} teams</span> on the
              leaderboard advance to the next stage.
            </p>
            <Button to="/register" className="mt-6">Register your team <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </Card>
      </section>

      {/* Leaderboard (once live) + upcoming snapshot */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className={`grid gap-10 ${leaderboardLive ? 'lg:grid-cols-5' : 'lg:grid-cols-2'}`}>
          <div className={leaderboardLive ? 'lg:col-span-3' : ''}>
            <div className="mb-5 flex items-end justify-between">
              <SectionTitle eyebrow="Standings" title={leaderboardLive ? 'Top of the board' : 'Standings'} />
              {leaderboardLive && (
                <Link to="/leaderboard" className="inline-flex items-center gap-1 text-sm font-medium text-brandred-400 hover:text-brandred-300">
                  Full leaderboard <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
            {leaderboardLive ? (
              <LeaderboardTable rows={topTeams} advanceCount={advanceCount} compact />
            ) : (
              <Card className="flex h-full flex-col items-center justify-center gap-3 bg-board-grid p-10 text-center">
                <Trophy className="h-9 w-9 text-brandred-400" />
                <h3 className="text-lg font-semibold text-white">The leaderboard goes live after the first match</h3>
                <p className="max-w-sm text-sm text-gray-400">
                  Teams are registering now. Once round one’s first game is played, standings appear
                  here automatically — and the top {advanceCount} race begins.
                </p>
              </Card>
            )}
          </div>

          <div className={leaderboardLive ? 'lg:col-span-2' : ''}>
            <div className="mb-5 flex items-end justify-between">
              <SectionTitle eyebrow="Schedule" title="Next matches" />
              <Link to="/matches" className="inline-flex items-center gap-1 text-sm font-medium text-brandred-400 hover:text-brandred-300">
                All matches <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="space-y-4">
              {upcoming.length ? (
                upcoming.map((m) => <MatchCard key={m.id} match={m} teams={teams} />)
              ) : (
                <Card className="p-6 text-center text-sm text-gray-400">No upcoming matches scheduled.</Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-white/10">
          <img src={boardPhoto} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-r from-board-950 via-board-950/85 to-brandred-700/40" />
          <div className="relative flex flex-col items-center gap-6 p-12 text-center">
            <KingGlyph className="h-12 w-12" />
            <h2 className="max-w-xl font-serif text-3xl font-bold text-white sm:text-4xl">Ready to make your move?</h2>
            <p className="max-w-lg text-gray-200">
              Gather your team and register for Checkmate. Spots are reviewed by the Coderina organizers.
            </p>
            <Button to="/register" size="lg">Register your team <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </section>
    </div>
  );
}
