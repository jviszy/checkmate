import { Link } from 'react-router-dom';
import pieces from '../assets/checkmate-pieces.png';
import fullLogo from '../assets/checkmate-logo.png';

/**
 * The two Checkmate chess pieces (red king + gold queen), cropped from the
 * official Coderina logo. Used as the compact brand mark.
 */
export function KingGlyph({ className = 'h-8 w-8' }) {
  return <img src={pieces} alt="" aria-hidden="true" className={`${className} object-contain`} />;
}

/** The full official Checkmate logo (pieces + wordmark + "by Coderina"). */
export function FullLogo({ className = '' }) {
  return <img src={fullLogo} alt="Checkmate by Coderina" className={`${className} object-contain`} />;
}

export default function Logo() {
  return (
    <Link to="/" className="group inline-flex items-center gap-2.5">
      <img
        src={pieces}
        alt=""
        aria-hidden="true"
        className="h-10 w-auto object-contain transition-transform duration-300 group-hover:-translate-y-0.5"
      />
      <span className="leading-none">
        <span className="block font-serif text-2xl font-bold tracking-tight text-white">
          Check<span className="text-gradient-gold">mate</span>
        </span>
        <span className="block text-[10px] font-medium uppercase tracking-[0.28em] text-gray-500">
          by Coderina
        </span>
      </span>
    </Link>
  );
}
