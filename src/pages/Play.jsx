import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Flag, Crown, Circle, ArrowLeft, Radio, Eye, Lightbulb, Clock } from 'lucide-react';
import { Card, Button, TeamMark, StatusPill } from '../components/ui.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import { useAuth } from '../context/AuthContext.jsx';
import { updateGame, completeGame } from '../lib/api.js';
import { teamById } from '../lib/format.js';

const BOARD_DARK = '#6b1420';
const BOARD_LIGHT = '#efe2cf';
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function fmtClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function Play() {
  const { gameId } = useParams();
  const { games, teams, players } = useCheckmate();
  const { user } = useAuth();

  const game = games.find((g) => g.id === gameId);

  const chess = useMemo(() => {
    try { return new Chess(game?.fen || undefined); } catch { return new Chess(); }
  }, [game?.fen]);

  const [selected, setSelected] = useState(null);
  const [hint, setHint] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const flaggedRef = useRef(false);

  // Tick the clock while the game is live.
  useEffect(() => {
    if (game?.status !== 'live') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [game?.status]);

  const turnColor = chess.turn() === 'w' ? 'white' : 'black';

  // Live remaining time for a side (the side to move counts down from lastMoveAt).
  const liveMs = useCallback((color) => {
    if (!game) return 0;
    const base = color === 'white' ? game.whiteMs : game.blackMs;
    if (game.status === 'live' && game.lastMoveAt && color === turnColor) {
      return base - (now - new Date(game.lastMoveAt).getTime());
    }
    return base;
  }, [game, now, turnColor]);

  // Roles / control.
  const isAdmin = user?.role === 'admin';
  const white = game && teamById(teams, game.whiteTeamId);
  const black = game && teamById(teams, game.blackTeamId);
  const coachControls = user?.role === 'coach' && (white?.coachId === user.coachId || black?.coachId === user.coachId);
  const myColor =
    user?.playerId && game && user.playerId === game.whitePlayerId ? 'white'
    : user?.playerId && game && user.playerId === game.blackPlayerId ? 'black'
    : null;
  const canControl = useCallback((color) =>
    game && game.status !== 'completed' && (isAdmin || coachControls || myColor === color),
    [game, isAdmin, coachControls, myColor]);

  // Flag fall — only the controlling client records it, once.
  useEffect(() => {
    if (!game || game.status !== 'live' || !game.lastMoveAt) return;
    if (!canControl(turnColor)) return;
    if (liveMs(turnColor) <= 0 && !flaggedRef.current) {
      flaggedRef.current = true;
      completeGame(game.id, turnColor === 'white' ? 'black' : 'white', { fen: game.fen, pgn: game.pgn });
    }
  }, [now, game, turnColor, canControl, liveMs]);

  // Apply a move (shared by drag + click). Returns true if legal.
  const applyMove = useCallback((from, to) => {
    if (!game || game.status === 'completed' || !canControl(turnColor)) return false;
    const probe = new Chess(game.fen);
    let move;
    try { move = probe.move({ from, to, promotion: 'q' }); } catch { return false; }
    if (!move) return false;

    // Clock: deduct the mover's elapsed time, add the increment.
    const elapsed = game.lastMoveAt ? (Date.now() - new Date(game.lastMoveAt).getTime()) : 0;
    const moverBase = turnColor === 'white' ? game.whiteMs : game.blackMs;
    const moverMs = Math.max(0, moverBase - elapsed + (game.incrementMs || 0));
    const clocks = {
      whiteMs: turnColor === 'white' ? moverMs : game.whiteMs,
      blackMs: turnColor === 'black' ? moverMs : game.blackMs,
      lastMoveAt: new Date().toISOString(),
    };

    setSelected(null); setHint(null);
    if (probe.isGameOver()) {
      let result = 'draw';
      if (probe.isCheckmate()) result = probe.turn() === 'w' ? 'black' : 'white';
      completeGame(game.id, result, { fen: probe.fen(), pgn: probe.pgn() });
    } else {
      updateGame(game.id, { fen: probe.fen(), pgn: probe.pgn(), status: 'live', ...clocks });
    }
    return true;
  }, [game, canControl, turnColor]);

  function onPieceDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare) return false;
    return applyMove(sourceSquare, targetSquare);
  }

  // Click-to-move + show legal moves for the selected piece.
  const legalTargets = useMemo(() => {
    if (!selected || !game) return [];
    try { return chess.moves({ square: selected, verbose: true }).map((m) => m.to); }
    catch { return []; }
  }, [selected, chess, game]);

  function onSquareClick({ square, piece }) {
    if (!game || game.status === 'completed' || !canControl(turnColor)) return;
    if (selected && legalTargets.includes(square)) { applyMove(selected, square); return; }
    // Select one of the side-to-move's own pieces.
    const p = chess.get(square);
    if (p && ((turnColor === 'white' && p.color === 'w') || (turnColor === 'black' && p.color === 'b'))) {
      setSelected(square); setHint(null);
    } else {
      setSelected(null);
    }
  }

  // Suggested move (hint): prefer mate, then best capture, then a check, else central.
  function showHint() {
    if (!game || !canControl(turnColor)) return;
    const moves = chess.moves({ verbose: true });
    if (!moves.length) return;
    const score = (m) => {
      let s = 0;
      if (m.san.includes('#')) s += 1000;
      if (m.captured) s += 10 + PIECE_VALUE[m.captured] * 2;
      if (m.san.includes('+')) s += 3;
      if (m.promotion) s += 8;
      if (['d4', 'e4', 'd5', 'e5', 'c4', 'f4'].includes(m.to)) s += 1;
      return s;
    };
    const best = moves.slice().sort((a, b) => score(b) - score(a))[0];
    setSelected(null);
    setHint({ from: best.from, to: best.to });
  }

  // Board square highlights.
  const squareStyles = useMemo(() => {
    const styles = {};
    if (selected) {
      styles[selected] = { background: 'rgba(228,0,20,0.30)' };
      for (const t of legalTargets) {
        const capture = chess.get(t);
        styles[t] = capture
          ? { background: 'radial-gradient(circle, transparent 52%, rgba(228,0,20,0.55) 54%)' }
          : { background: 'radial-gradient(circle, rgba(228,0,20,0.55) 22%, transparent 24%)' };
      }
    }
    if (hint) {
      styles[hint.from] = { boxShadow: 'inset 0 0 0 3px #f9a826' };
      styles[hint.to] = { boxShadow: 'inset 0 0 0 3px #f9a826' };
    }
    return styles;
  }, [selected, legalTargets, hint, chess]);

  if (!game) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-white">Game not found</h1>
        <p className="mt-2 text-gray-400">This board may have ended or been removed.</p>
        <Button to="/matches" className="mt-6"><ArrowLeft className="h-4 w-4" /> Back to matches</Button>
      </div>
    );
  }

  const whitePlayer = players.find((p) => p.id === game.whitePlayerId);
  const blackPlayer = players.find((p) => p.id === game.blackPlayerId);
  const isSpectator = !myColor && !isAdmin && !coachControls;
  const orientation = myColor === 'black' ? 'black' : 'white';
  const canMoveNow = canControl(turnColor);

  const moves = chess.history();
  const movePairs = [];
  for (let i = 0; i < moves.length; i += 2) movePairs.push({ n: i / 2 + 1, w: moves[i], b: moves[i + 1] });

  const resultLabel = game.status === 'completed'
    ? game.result === 'draw' ? 'Draw' : `${(game.result === 'white' ? white : black)?.name} wins`
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/matches" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Matches
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Round {game.round}</span>
          <StatusPill status={game.status} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <PlayerBar team={black} player={blackPlayer} clock={fmtClock(liveMs('black'))}
            low={liveMs('black') < 30000} toMove={turnColor === 'black' && game.status === 'live'} />
          <div className="my-3">
            <Chessboard
              options={{
                id: 'checkmate-board',
                position: game.fen,
                onPieceDrop,
                onSquareClick,
                squareStyles,
                boardOrientation: orientation,
                allowDragging: canMoveNow,
                darkSquareStyle: { backgroundColor: BOARD_DARK },
                lightSquareStyle: { backgroundColor: BOARD_LIGHT },
                boardStyle: { borderRadius: '12px', overflow: 'hidden' },
              }}
            />
          </div>
          <PlayerBar team={white} player={whitePlayer} clock={fmtClock(liveMs('white'))}
            low={liveMs('white') < 30000} toMove={turnColor === 'white' && game.status === 'live'} />
        </div>

        <div className="space-y-4">
          {game.status === 'completed' ? (
            <Card className="flex items-center gap-3 border-brandred-500/40 bg-brandred-500/10 p-4">
              <Crown className="h-6 w-6 text-brandred-400" />
              <div>
                <div className="font-semibold text-white">{resultLabel}</div>
                <div className="text-xs text-gray-400">Result recorded to the scoreboard</div>
              </div>
            </Card>
          ) : (
            <Card className="flex items-center gap-3 p-4">
              {isSpectator ? <Eye className="h-5 w-5 text-gray-400" /> : <Radio className="h-5 w-5 text-brandred-400" />}
              <div className="text-sm">
                {isSpectator ? <span className="text-gray-300">Spectating — moves update live</span>
                  : canMoveNow ? <span className="text-white">Your move ({turnColor})</span>
                  : <span className="text-gray-400">Waiting for {turnColor} to move…</span>}
              </div>
            </Card>
          )}

          {/* Suggested move + resign for whoever you control */}
          {game.status !== 'completed' && !isSpectator && (
            <div className="flex flex-wrap gap-2">
              {canMoveNow && (
                <Button size="sm" onClick={showHint}><Lightbulb className="h-3.5 w-3.5" /> Suggest a move</Button>
              )}
              {canControl('white') && <Button variant="outline" size="sm" onClick={() => resign('white')}><Flag className="h-3.5 w-3.5" /> White resigns</Button>}
              {canControl('black') && <Button variant="outline" size="sm" onClick={() => resign('black')}><Flag className="h-3.5 w-3.5" /> Black resigns</Button>}
            </div>
          )}
          {hint && (
            <p className="text-xs text-gold-300">Suggested: <span className="font-mono font-semibold">{hint.from} → {hint.to}</span> (highlighted in gold)</p>
          )}
          {!isSpectator && game.status !== 'completed' && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500"><Clock className="h-3.5 w-3.5" /> Tap a piece to see its legal moves.</p>
          )}

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Moves</h3>
            {movePairs.length === 0 ? <p className="text-sm text-gray-500">No moves yet.</p> : (
              <ol className="max-h-72 space-y-1 overflow-y-auto font-mono text-sm">
                {movePairs.map((m) => (
                  <li key={m.n} className="flex gap-3 text-gray-300">
                    <span className="w-6 text-gray-500">{m.n}.</span>
                    <span className="w-16">{m.w}</span>
                    <span className="w-16">{m.b || ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );

  function resign(color) {
    if (!canControl(color)) return;
    if (!confirm(`Resign the game for ${color === 'white' ? white?.name : black?.name}?`)) return;
    completeGame(game.id, color === 'white' ? 'black' : 'white', { fen: game.fen, pgn: game.pgn });
  }
}

function PlayerBar({ team, player, clock, low, toMove }) {
  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${toMove ? 'border-brandred-500/50 bg-brandred-500/10' : 'border-white/10 bg-board-800/60'}`}>
      <div className="flex items-center gap-3">
        <TeamMark name={team?.name || '?'} logoUrl={team?.logoUrl} size={34} />
        <div>
          <div className="text-sm font-medium text-white">{player?.displayName || 'TBD'}</div>
          <div className="text-xs text-gray-500">{team?.name || ''}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {toMove && <Circle className="h-2.5 w-2.5 animate-pulse fill-brandred-400 text-brandred-400" />}
        <span className={`rounded-lg px-3 py-1 font-mono text-lg font-bold tabular-nums ${low ? 'bg-brandred-500/20 text-brandred-300' : 'bg-black/30 text-white'}`}>
          {clock}
        </span>
      </div>
    </div>
  );
}
