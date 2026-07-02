import { Link } from 'react-router-dom';
import { FullLogo } from './Logo.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';

export default function Footer() {
  const { leaderboardLive } = useCheckmate();
  return (
    <footer className="mt-24 border-t border-white/10 bg-board-900">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <FullLogo className="h-20 w-auto" />
          <p className="mt-4 max-w-xs text-sm text-gray-400">
            Empowering minds through the game of kings — the Coderina chess competition,
            advancing STEAM education across Africa.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-300">Competition</h4>
          <ul className="mt-3 space-y-2 text-sm text-gray-400">
            {leaderboardLive && (
              <li><Link to="/leaderboard" className="hover:text-brandred-400">Leaderboard</Link></li>
            )}
            <li><Link to="/matches" className="hover:text-brandred-400">Match schedule</Link></li>
            <li><Link to="/register" className="hover:text-brandred-400">Register a team</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-300">Coderina</h4>
          <ul className="mt-3 space-y-2 text-sm text-gray-400">
            <li><a href="https://www.coderina.org/" target="_blank" rel="noreferrer" className="hover:text-brandred-400">coderina.org</a></li>
            <li><span>Empowering STEAM Education Across Africa</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Coderina · Checkmate Chess Competition. All rights reserved.
      </div>
    </footer>
  );
}
