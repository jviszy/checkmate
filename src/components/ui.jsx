import { Link } from 'react-router-dom';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brandred-400/60 disabled:opacity-50 disabled:cursor-not-allowed';

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3 text-base',
};

const variants = {
  primary: 'bg-brandred-500 text-board-950 hover:bg-brandred-400 shadow-lg shadow-brandred-500/20',
  outline: 'border border-brandred-500/40 text-brandred-300 hover:bg-brandred-500/10 hover:border-brandred-500',
  ghost: 'text-gray-300 hover:text-brandred-400 hover:bg-white/5',
  success: 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20',
  danger: 'bg-brandred-500 text-white hover:bg-brandred-600',
};

export function Button({ as = 'button', to, href, variant = 'primary', size = 'md', className = '', children, ...rest }) {
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>;
  const Tag = as;
  return <Tag className={cls} {...rest}>{children}</Tag>;
}

export function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-board-800/60 backdrop-blur-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

const statusStyles = {
  pending: 'bg-brandred-500/15 text-brandred-300 border-brandred-500/30',
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  advanced: 'bg-brandred-500/20 text-brandred-300 border-brandred-500/40',
  eliminated: 'bg-white/5 text-gray-400 border-white/10',
  scheduled: 'bg-white/10 text-gray-300 border-white/15',
  live: 'bg-brandred-500/20 text-brandred-400 border-brandred-500/40',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

export function StatusPill({ status, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[status] || statusStyles.scheduled} ${className}`}
    >
      {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brandred-400" />}
      {status}
    </span>
  );
}

export function SectionTitle({ eyebrow, title, subtitle, center = false, className = '' }) {
  return (
    <div className={`${center ? 'mx-auto text-center' : ''} max-w-2xl ${className}`}>
      {eyebrow && (
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brandred-500">{eyebrow}</span>
      )}
      <h2 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-gray-400">{subtitle}</p>}
    </div>
  );
}

/** Round initials badge used as a stand-in team logo. */
export function TeamMark({ name, logoUrl, size = 40 }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="rounded-lg object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brandred-500 to-brandred-700 font-semibold text-board-950"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}
