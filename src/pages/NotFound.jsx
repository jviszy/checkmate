import { Button } from '../components/ui.jsx';
import { KingGlyph } from '../components/Logo.jsx';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-32 text-center">
      <KingGlyph className="h-16 w-16 opacity-60" />
      <h1 className="mt-6 text-4xl font-semibold text-white">Checkmate — wrong square</h1>
      <p className="mt-3 text-gray-400">
        That page isn't on the board. Let's get you back to a legal move.
      </p>
      <Button to="/" className="mt-8">Back to home</Button>
    </div>
  );
}
