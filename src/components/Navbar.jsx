import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, Shield, KeyRound } from 'lucide-react';
import Logo from './Logo.jsx';
import { Button } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { isAuthed, isAdmin, isCoach, user, signOut } = useAuth();
  const { leaderboardLive } = useCheckmate();
  const navigate = useNavigate();

  // Leaderboard link only appears once the competition's first match is played.
  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/matches', label: 'Matches' },
    ...(leaderboardLive ? [{ to: '/leaderboard', label: 'Leaderboard' }] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    navigate('/');
  };

  const linkClass = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'text-brandred-400' : 'text-gray-300 hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-board-950/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          {isCoach && (
            <NavLink to="/coach" className={linkClass}>My teams</NavLink>
          )}
          {isAuthed && !isCoach && !isAdmin && (
            <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={linkClass}>Admin</NavLink>
          )}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthed ? (
            <>
              <span className="text-sm text-gray-400">Hi, {user.displayName.split(' ')[0]}</span>
              <Button variant="ghost" size="sm" to="/account">
                <KeyRound className="h-4 w-4" /> Password
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" to="/login">Sign in</Button>
              <Button variant="primary" size="sm" to="/register">Register team</Button>
            </>
          )}
        </div>

        <button
          className="rounded-lg p-2 text-gray-300 hover:bg-white/5 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-board-900 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
            {isCoach && (
              <NavLink to="/coach" className={linkClass} onClick={() => setOpen(false)}>
                <LayoutDashboard className="mr-1 inline h-4 w-4" /> My teams
              </NavLink>
            )}
            {isAuthed && !isCoach && !isAdmin && (
              <NavLink to="/dashboard" className={linkClass} onClick={() => setOpen(false)}>
                <LayoutDashboard className="mr-1 inline h-4 w-4" /> Dashboard
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className={linkClass} onClick={() => setOpen(false)}>
                <Shield className="mr-1 inline h-4 w-4" /> Admin
              </NavLink>
            )}
            {isAuthed && (
              <NavLink to="/account" className={linkClass} onClick={() => setOpen(false)}>
                <KeyRound className="mr-1 inline h-4 w-4" /> Change password
              </NavLink>
            )}
            <div className="mt-3 flex flex-col gap-2">
              {isAuthed ? (
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" to="/login" onClick={() => setOpen(false)}>Sign in</Button>
                  <Button variant="primary" size="sm" to="/register" onClick={() => setOpen(false)}>Register team</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
