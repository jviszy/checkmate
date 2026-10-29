import { useState, useMemo, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import {
  Flag, Crown, Circle, ArrowLeft, Lightbulb, RotateCcw,
  Bot, Users, Sparkles, BookOpen, Clock, ShieldCheck, CheckCircle2,
} from 'lucide-react';
import { Card, Button, StatusPill, TeamMark } from '../components/ui.jsx';

const BOARD_DARK = '#6b1420';
const BOARD_LIGHT = '#efe2cf';
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const DEFAULT_CLOCK_MS = 10 * 60 * 1000;
const INCREMENT_MS = 3 * 1000;

function fmtClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const SAMPLE_DEMO_OPENING = [
  { from: 'e2', to: 'e4' },
  { from: 'e7', to: 'e5' },
  { from: 'g1', to: 'f3' },
  { from: 'b8', to: 'c6' },
  { from: 'f1', to: 'c4' },
  { from: 'f8', to: 'c5' },
];

export default function DemoMatch() {
  const [fen, setFen] = useState(() => new Chess().fen());
  const [selected, setSelected] = useState(null);
  const [hint, setHint] = useState(null);
  const [whiteMs, setWhiteMs] = useState(DEFAULT_CLOCK_MS);
  const [blackMs, setBlackMs] = useState(DEFAULT_CLOCK_MS);
  const [clockRunning, setClockRunning] = useState(true);
  const [playMode, setPlayMode] = useState('bot'); // 'bot' | 'pass'
  const [botThinking, setBotThinking] = useState(false);
  const [result, setResult] = useState(null); // null | 'white' | 'black' | 'draw'
  const [statusText, setStatusText] = useState('Demo Match Live');
  const [demoStep, setDemoStep] = useState(0);

  const chess = useMemo(() => {
    try { return new Chess(fen); } catch { return new Chess(); }
  }, [fen]);

  const turnColor = chess.turn() === 'w' ? 'white' : 'black';

  // Clock countdown ticker
  useEffect(() => {
    if (!clockRunning || result) return;
    const interval = setInterval(() => {
      if (turnColor === 'white') {
        setWhiteMs((ms) => {
          if (ms <= 1000) {
            setResult('black');
            setStatusText('Black wins on time (Demo flag fall)');
            return 0;
          }
          return ms - 250;
        });
      } else {
        setBlackMs((ms) => {
          if (ms <= 1000) {
            setResult('white');
            setStatusText('White wins on time (Demo flag fall)');
            return 0;
          }
          return ms - 250;
        });
      }
    }, 250);
    return () => clearInterval(interval);
  }, [clockRunning, turnColor, result]);

  // Automated bot response when in 'bot' mode and it's Black's turn
  useEffect(() => {
    if (playMode !== 'bot' || result || turnColor !== 'black' || botThinking) return;

    setBotThinking(true);
    const timer = setTimeout(() => {
      const probe = new Chess(fen);
      const moves = probe.moves({ verbose: true });
      if (!moves.length) {
        setBotThinking(false);
        return;
      }

      // Prioritize capture or checks, else pick smart central move
      moves.sort((a, b) => {
        let sa = (a.captured ? PIECE_VALUE[a.captured] * 2 : 0) + (a.san.includes('+') ? 2 : 0);
        let sb = (b.captured ? PIECE_VALUE[b.captured] * 2 : 0) + (b.san.includes('+') ? 2 : 0);
        return sb - sa;
      });
      const chosen = moves[0];
      probe.move(chosen);

      setBlackMs((ms) => ms + INCREMENT_MS);
      setFen(probe.fen());
      setBotThinking(false);

      if (probe.isGameOver()) {
        if (probe.isCheckmate()) {
          setResult('black');
          setStatusText('Demo Bot wins by checkmate!');
        } else {
          setResult('draw');
          setStatusText('Game drawn!');
        }
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [fen, turnColor, playMode, result, botThinking]);

  // Move application
  const applyMove = useCallback((from, to) => {
    if (result) return false;
    const probe = new Chess(fen);
    let move = null;
    try {
      move = probe.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    if (!move) return false;

    // Apply increment to mover
    if (turnColor === 'white') {
      setWhiteMs((ms) => ms + INCREMENT_MS);
    } else {
      setBlackMs((ms) => ms + INCREMENT_MS);
    }

    setSelected(null);
    setHint(null);
    setFen(probe.fen());

    if (probe.isGameOver()) {
      if (probe.isCheckmate()) {
        const winner = probe.turn() === 'w' ? 'black' : 'white';
        setResult(winner);
        setStatusText(`${winner === 'white' ? 'White' : 'Black'} wins by checkmate!`);
      } else {
        setResult('draw');
        setStatusText('Game drawn!');
      }
    }
    return true;
  }, [fen, turnColor, result]);

  const onPieceDrop = ({ sourceSquare, targetSquare }) => {
    if (!targetSquare || result) return false;
    if (playMode === 'bot' && turnColor !== 'white') return false;
    return applyMove(sourceSquare, targetSquare);
  };

  const legalTargets = useMemo(() => {
    if (!selected) return [];
    try {
      return chess.moves({ square: selected, verbose: true }).map((m) => m.to);
    } catch {
      return [];
    }
  }, [selected, chess]);

  const onSquareClick = ({ square }) => {
    if (result) return;
    if (playMode === 'bot' && turnColor !== 'white') return;

    if (selected && legalTargets.includes(square)) {
      applyMove(selected, square);
      return;
    }

    const piece = chess.get(square);
    if (piece && ((turnColor === 'white' && piece.color === 'w') || (turnColor === 'black' && piece.color === 'b'))) {
      setSelected(square);
      setHint(null);
    } else {
      setSelected(null);
    }
  };

  const showHint = () => {
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
  };

  const resetBoard = () => {
    setFen(new Chess().fen());
    setSelected(null);
    setHint(null);
    setWhiteMs(DEFAULT_CLOCK_MS);
    setBlackMs(DEFAULT_CLOCK_MS);
    setResult(null);
    setStatusText('Demo Match Live');
    setClockRunning(true);
    setDemoStep(0);
  };

  const playNextDemoOpeningMove = () => {
    if (demoStep >= SAMPLE_DEMO_OPENING.length) return;
    const step = SAMPLE_DEMO_OPENING[demoStep];
    applyMove(step.from, step.to);
    setDemoStep((s) => s + 1);
  };

  const squareStyles = useMemo(() => {
    const styles = {};
    if (selected) {
      styles[selected] = { background: 'rgba(228,0,20,0.35)' };
      for (const t of legalTargets) {
        const capture = chess.get(t);
        styles[t] = capture
          ? { background: 'radial-gradient(circle, transparent 52%, rgba(228,0,20,0.60) 54%)' }
          : { background: 'radial-gradient(circle, rgba(228,0,20,0.60) 22%, transparent 24%)' };
      }
    }
    if (hint) {
      styles[hint.from] = { boxShadow: 'inset 0 0 0 3px #f9a826' };
      styles[hint.to] = { boxShadow: 'inset 0 0 0 3px #f9a826' };
    }
    return styles;
  }, [selected, legalTargets, hint, chess]);

  const moves = chess.history();
  const movePairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({ n: i / 2 + 1, w: moves[i], b: moves[i + 1] });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Top Banner: Clearly Labeled as Demo */}
      <div className="mb-6 rounded-2xl border border-brandred-500/30 bg-gradient-to-r from-brandred-950/70 via-board-900 to-board-950 p-5 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-brandred-500/20 p-2.5 text-brandred-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brandred-500/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-brandred-400">
                  Demo Mode
                </span>
                <span className="text-xs text-gray-400">Safe Sandbox · Non-Competitive</span>
              </div>
              <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">Live Chess Match Demo</h1>
              <p className="mt-1 text-sm text-gray-300">
                Practice and explore how live matches work on Checkmate. All moves and timers here are strictly
                isolated and <strong className="text-white">will not affect real tournament rankings or scores</strong>.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" to="/register">
              <ArrowLeft className="h-4 w-4" /> Registration
            </Button>
            <Button variant="outline" size="sm" to="/dashboard">
              Dashboard
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left Column: Board & Players */}
        <div>
          {/* Black Player Bar (Demo opponent) */}
          <DemoPlayerBar
            teamName="Iron Rooks"
            playerName={playMode === 'bot' ? 'Demo Bot (Black)' : 'Demo Player (Black)'}
            clock={fmtClock(blackMs)}
            low={blackMs < 30000}
            toMove={turnColor === 'black' && !result}
            thinking={botThinking}
          />

          <div className="my-3">
            <Chessboard
              options={{
                id: 'demo-checkmate-board',
                position: fen,
                onPieceDrop,
                onSquareClick,
                squareStyles,
                boardOrientation: 'white',
                allowDragging: !result && (playMode === 'pass' || turnColor === 'white'),
                darkSquareStyle: { backgroundColor: BOARD_DARK },
                lightSquareStyle: { backgroundColor: BOARD_LIGHT },
                boardStyle: { borderRadius: '12px', overflow: 'hidden' },
              }}
            />
          </div>

          {/* White Player Bar (User / Demo White) */}
          <DemoPlayerBar
            teamName="Royal Knights"
            playerName="Your Team (White)"
            clock={fmtClock(whiteMs)}
            low={whiteMs < 30000}
            toMove={turnColor === 'white' && !result}
          />

          {/* Interactive Mode & Sandbox Controls */}
          <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400">Mode:</span>
              <button
                type="button"
                onClick={() => setPlayMode('bot')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  playMode === 'bot' ? 'bg-brandred-500 text-board-950' : 'bg-white/5 text-gray-300 hover:text-white'
                }`}
              >
                <Bot className="h-3.5 w-3.5" /> Play vs Bot
              </button>
              <button
                type="button"
                onClick={() => setPlayMode('pass')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  playMode === 'pass' ? 'bg-brandred-500 text-board-950' : 'bg-white/5 text-gray-300 hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" /> Pass & Play (Both Sides)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={resetBoard}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset Demo
              </Button>
              {demoStep < SAMPLE_DEMO_OPENING.length && !result && (
                <Button size="sm" variant="outline" onClick={playNextDemoOpeningMove}>
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Play Sample Move
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Actions, Moves, and Walkthrough */}
        <div className="space-y-4">
          {/* Result or Live Status */}
          {result ? (
            <Card className="border-brandred-500/50 bg-brandred-500/10 p-5">
              <div className="flex items-center gap-3">
                <Crown className="h-7 w-7 text-brandred-400" />
                <div>
                  <h3 className="font-bold text-white">{statusText}</h3>
                  <p className="mt-0.5 text-xs text-gray-300">
                    In a real match, White would earn {result === 'white' ? '1' : result === 'draw' ? '0.5' : '0'} pt
                    and Black {result === 'black' ? '1' : result === 'draw' ? '0.5' : '0'} pt toward their team totals.
                  </p>
                </div>
              </div>
              <Button size="sm" className="mt-3 w-full" onClick={resetBoard}>
                <RotateCcw className="h-3.5 w-3.5" /> Play Another Demo Match
              </Button>
            </Card>
          ) : (
            <Card className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2.5">
                <Circle className="h-2.5 w-2.5 animate-pulse fill-brandred-400 text-brandred-400" />
                <span className="text-sm font-medium text-white">
                  {turnColor === 'white' ? 'Your turn to move (White)' : botThinking ? 'Bot thinking…' : "Black's turn to move"}
                </span>
              </div>
              <StatusPill status="live" />
            </Card>
          )}

          {/* In-game action hints */}
          {!result && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={showHint}>
                <Lightbulb className="h-3.5 w-3.5 text-amber-400" /> Suggest a move
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setResult('black'); setStatusText('White resigned (Demo)'); }}>
                <Flag className="h-3.5 w-3.5 text-gray-400" /> Simulate resign
              </Button>
            </div>
          )}

          {hint && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              💡 Suggested move: <span className="font-mono font-bold">{hint.from} → {hint.to}</span> (highlighted in gold)
            </p>
          )}

          {/* Moves History */}
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Notation</h3>
              <span className="text-xs text-gray-500">{moves.length} moves played</span>
            </div>
            {movePairs.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-500">Drag a piece on the board or tap to move.</p>
            ) : (
              <ol className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs">
                {movePairs.map((m) => (
                  <li key={m.n} className="flex gap-4 text-gray-300">
                    <span className="w-5 text-gray-500">{m.n}.</span>
                    <span className="w-16 font-semibold">{m.w}</span>
                    <span className="w-16 text-gray-400">{m.b || ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* How live chess matches work — Interactive Guide */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-brandred-400" />
              <h3 className="text-sm font-semibold text-white">How Live Matches Work</h3>
            </div>
            <ul className="space-y-2.5 text-xs text-gray-300">
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brandred-400" />
                <span>
                  <strong>10-Min Clocks + 3s Increment:</strong> Your clock only counts down on your turn. Every move adds 3 seconds.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>
                  <strong>Tap or Drag to Move:</strong> Tap any of your pieces to see legal moves highlighted.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Crown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>
                  <strong>Team Points Rollup:</strong> Wins give 1.0 point, draws 0.5. All player scores sum into the team total.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                <span>
                  <strong>Zero-Risk Sandbox:</strong> Demos are non-competitive so teams can practice freely.
                </span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DemoPlayerBar({ teamName, playerName, clock, low, toMove, thinking }) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-4 py-2.5 transition-colors ${
        toMove
          ? 'border-brandred-500/50 bg-brandred-500/10'
          : 'border-white/10 bg-board-800/60'
      }`}
    >
      <div className="flex items-center gap-3">
        <TeamMark name={teamName} size={34} />
        <div>
          <div className="text-sm font-medium text-white">{playerName}</div>
          <div className="text-xs text-gray-500">
            {teamName} {thinking && <span className="text-brandred-400 animate-pulse">· thinking…</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {toMove && <Circle className="h-2.5 w-2.5 animate-pulse fill-brandred-400 text-brandred-400" />}
        <span
          className={`rounded-lg px-3 py-1 font-mono text-lg font-bold tabular-nums ${
            low ? 'bg-brandred-500/20 text-brandred-300' : 'bg-black/30 text-white'
          }`}
        >
          {clock}
        </span>
      </div>
    </div>
  );
}
