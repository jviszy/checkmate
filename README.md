# Checkmate — Coderina Chess Competition

A website for Coderina's **Checkmate** team chess competition: team registration,
auto-generated match fixtures, a live leaderboard, match schedule (next & previous),
per-team dashboards, and an organizer admin panel.

Branding follows [coderina.org](https://www.coderina.org/) — gold/amber on a dark
"board", teal + red accents, Cormorant Garamond display + Roboto/DM Sans body.

## The scoring rule

Scores are counted **per team, not per player**. Every member's individual points
roll up into one team total, and the **top 6 teams** (configurable) advance to the
next round.

## Tech stack

- **React 19 + Vite + React Router 7**
- **Tailwind CSS 4** (brand tokens in `src/index.css`)
- **framer-motion**, **lucide-react**
- **AWS Amplify Gen 2** backend (Cognito auth + AppSync/DynamoDB) — see `amplify/`

## Run locally

```bash
npm install
npm run dev
```

The app runs fully offline out of the box: the data layer (`src/lib/api.js`) is
backed by `localStorage` and seeded with demo teams, players, and matches so every
page works without a backend.

**Demo accounts**
- Admin — `admin@coderina.org` / `admin123`
- Player — `adaokeke@example.com` / `player123`

Use **Reset demo data** in the admin panel to restore the seed.

## Pages

| Route | Access | Purpose |
|-------|--------|---------|
| `/` | public | Landing — hero, how it works, scoring rule, leaderboard + next-match snapshots |
| `/leaderboard` | public | Full team rankings with podium and top-6 highlight |
| `/matches` | public | Fixtures: upcoming & previous, filterable by round |
| `/register` | public | Register a team (captain) or join one with a code |
| `/login` | public | Sign in |
| `/dashboard` | members | Team rank, total, roster contributions, your matches, join code |
| `/admin` | Admins | Approvals · Teams & Scores · Matches (generate + enter scores) · Round control |

## Project structure

```
amplify/            AWS Amplify Gen 2 backend (auth, data, backend.ts)
src/
  components/       Navbar, Footer, Layout, Logo, ui kit, LeaderboardTable, MatchCard
  context/          AuthContext (mock auth; swap for Amplify Auth)
  hooks/            useCheckmate — loads + live-syncs all data
  lib/
    api.js          Data layer (localStorage today; Amplify-ready signatures)
    scoring.js      Team-total + leaderboard logic
    matchgen/       Pluggable fixture generator (round-robin default)
    format.js       Date/score helpers
  pages/            Landing, Leaderboard, Matches, Register, Login, Dashboard, Admin
  routes/           ProtectedRoute / AdminRoute guards
```

## Match format

The competition format is intentionally swappable (`src/lib/matchgen/`). It ships
with **round-robin** (everyone plays everyone → top 6 advance). Adding a knockout
bracket or Swiss system later is one new case in `matchgen/index.js` — no UI change.

## Connecting the AWS backend

The `amplify/` folder defines the real backend (Cognito + DynamoDB + AppSync).
To deploy with Coderina's AWS account:

1. Configure AWS credentials locally (`aws configure` or an SSO profile).
2. Install backend tooling (if not already): `npm i -D @aws-amplify/backend @aws-amplify/backend-cli`
3. Stand up a personal cloud sandbox: `npx ampx sandbox`
   - This generates `amplify_outputs.json` at the project root.
4. Add an organizer to the **Admins** Cognito group (console or CLI) for admin access.
5. Swap the data layer: `src/lib/amplifyClient.example.js` shows the
   `generateClient<Schema>()` versions of the `api.js` functions. The signatures
   match, so pages don't change. Also point `AuthContext` at Amplify Auth.
6. Deploy hosting by connecting the Git repo in the Amplify console (production +
   per-branch preview environments).
