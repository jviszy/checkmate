import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Flag, Crown, Circle, ArrowLeft, Radio, Eye } from 'lucide-react';
import { Card, Button, TeamMark, StatusPill } from '../components/ui.jsx';
import { useCheckmate } from '../hooks/useCheckmate.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getGame, updateGame, completeGame } from '../lib/api.js';
import { teamById } from '../lib/format.js';

const BOARD_DARK = '#6b1420';
const BOARD_LIGHT = '#efe2cf';

export default function Play() {
  const { gameId } = useParams();
  const { games, teams, players } = useCheckmate();
  const { user } = useAuth();

  const game = games.find((g) => g.id === gameId);

  // A fresh Chess instance reflecting the current stored position.
  const chess = useMemo(() => {
    try { return new Chess(game?.fen || undefined); } catch { return new Chess(); }
  }, [game?.fen]);

  if (!game) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-white">Game not found</h1>
        <p className="mt-2 text-gray-400">This board may have ended or been removed.</p>
        <Button to="/matches" className="mt-6"><ArrowLeft className="h-4 w-4" /> Back to matches</Button>
      </div>
    );
  }

  const white = teamById(teams, game.whiteTeamId);
  const black = teamById(teams, game.blackTeamId);
  const whitePlayer = players.find((p) => p.id === game.whitePlayerId);
  const blackPlayer = players.find((p) => p.id === game.blackPlayerId);

  // What can the signed-in user control?
  const isAdmin = user?.role === 'admin';
  const coachControls = user?.role === 'coach' && (white?.coachId === user.coachId || black?.coachId === user.coachId);
  const myColor =
    user?.playerId && user.playerId === game.whitePlayerId ? 'white'
    : user?.playerId && user.playerId === game.blackPlayerId ? 'black'
    : null;
  // Admins/coaches may move either side to run the game.
  const canControl = (color) =>
    game.status !== 'completed' && (isAdmin || coachControls || myColor === color);
  const isSpectator = !myColor && !isAdmin && !coachControls;

  const orientation = myColor === 'black' ? 'black' : 'white';
  const turnColor = chess.turn() === 'w' ? 'white' : 'black';
  const canMoveNow = canControl(turnColor);

  function onPieceDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare || game.status === 'completed') return false;
    if (!canControl(turnColor)) return false;
    const probe = new Chess(game.fen);
    let move;
    try {
      move = probe.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    } catch { return false; }
    if (!move) return false;

    if (probe.isGameOver()) {
      let result = 'draw';
      if (probe.isCheckmate()) result = probe.turn() === 'w' ? 'black' : 'white';
      completeGame(game.id, result, { fen: probe.fen(), pgn: probe.pgn() });
    } else {
      updateGame(game.id, { fen: probe.fen(), pgn: probe.pgn(), status: 'live' });
    }
    return true;
  }

  function resign(color) {
    if (!canControl(color)) return;
    if (!confirm(`Resign the game for ${color === 'white' ? white?.name : black?.name}?`)) return;
    completeGame(game.id, color === 'white' ? 'black' : 'white', { fen: game.fen, pgn: game.pgn });
  }

  const moves = chess.history();
  const movePairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({ n: i / 2 + 1, w: moves[i], b: moves[i + 1] });
  }

  const resultLabel = game.status === 'completed'
    ? game.result === 'draw' ? 'Draw'
      : `${(game.result === 'white' ? white : black)?.name} wins`
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
        {/* Board + seats */}
        <div>
          <PlayerBar team={black} player={blackPlayer} toMove={turnColor === 'black' && game.status !== 'completed'} />
          <div className="my-3">
            <Chessboard
              options={{
                id: 'checkmate-board',
                position: game.fen,
                onPieceDrop,
                boardOrientation: orientation,
                allowDragging: canMoveNow,
                darkSquareStyle: { backgroundColor: BOARD_DARK },
                lightSquareStyle: { backgroundColor: BOARD_LIGHT },
                boardStyle: { borderRadius: '12px', overflow: 'hidden' },
              }}
            />
          </div>
          <PlayerBar team={white} player={whitePlayer} toMove={turnColor === 'white' && game.status !== 'completed'} />
        </div>

        {/* Side panel */}
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
                {isSpectator ? (
                  <span className="text-gray-300">Spectating — live</span>
                ) : canMoveNow ? (
                  <span className="text-white">Your move ({turnColor})</span>
                ) : (
                  <span className="text-gray-400">Waiting for {turnColor} to move…</span>
                )}
              </div>
            </Card>
          )}

          {/* Resign controls for whoever you control */}
          {game.status !== 'completed' && !isSpectator && (
            <div className="flex gap-2">
              {canControl('white') && (
                <Button variant="outline" size="sm" onClick={() => resign('white')}><Flag className="h-3.5 w-3.5" /> White resigns</Button>
              )}
              {canControl('black') && (
                <Button variant="outline" size="sm" onClick={() => resign('black')}><Flag className="h-3.5 w-3.5" /> Black resigns</Button>
              )}
            </div>
          )}

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Moves</h3>
            {movePairs.length === 0 ? (
              <p className="text-sm text-gray-500">No moves yet.</p>
            ) : (
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
}

function PlayerBar({ team, player, toMove }) {
  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${toMove ? 'border-brandred-500/50 bg-brandred-500/10' : 'border-white/10 bg-board-800/60'}`}>
      <div className="flex items-center gap-3">
        <TeamMark name={team?.name || '?'} logoUrl={team?.logoUrl} size={34} />
        <div>
          <div className="text-sm font-medium text-white">{player?.displayName || 'TBD'}</div>
          <div className="text-xs text-gray-500">{team?.name || ''}</div>
        </div>
      </div>
      {toMove && <Circle className="h-3 w-3 animate-pulse fill-brandred-400 text-brandred-400" />}
    </div>
  );
}
