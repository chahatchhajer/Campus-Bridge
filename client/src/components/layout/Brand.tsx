import { Link } from 'react-router-dom';

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d="M5 22h22M8 22c0-6 3.5-10 8-10s8 4 8 10M16 12v10M11 22v-6M21 22v-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ to = '/', compact }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="brand" aria-label="Campus Bridge home">
      <BrandMark size={compact ? 26 : 28} />
      <span className="brand__name">Campus Bridge</span>
    </Link>
  );
}
