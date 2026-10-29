import { AlertTriangle, Info, RefreshCw, type LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { errorMessage } from '../../lib/api';
import { Button } from './Button';

export function Skeleton({ w, h = 16, style }: { w?: number | string; h?: number | string; style?: CSSProperties }) {
  return <span className="skeleton" aria-hidden="true" style={{ width: w ?? '100%', height: h, ...style }} />;
}

export function SkeletonRows({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} style={{ display: 'grid', gap: 'var(--s-3)', padding: 'var(--s-5)' }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: 'var(--s-4)', alignItems: 'center' }}>
          <Skeleton w="34%" h={14} />
          <Skeleton w="18%" h={14} />
          <Skeleton w="12%" h={14} style={{ marginLeft: 'auto' }} />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function SkeletonCard({ h = 160, label = 'Loading' }: { h?: number; label?: string }) {
  return (
    <div className="card" role="status" aria-label={label} style={{ padding: 'var(--s-5)' }}>
      <Skeleton w="40%" h={16} />
      <Skeleton h={h} style={{ marginTop: 'var(--s-4)' }} />
      <span className="sr-only">{label}</span>
    </div>
  );
}

type EmptyProps = { icon: LucideIcon; title: string; text?: ReactNode; actions?: ReactNode; compact?: boolean };

export function EmptyState({ icon: Icon, title, text, actions, compact }: EmptyProps) {
  return (
    <div className={`empty ${compact ? 'empty--compact' : ''}`}>
      <div className="empty__icon">
        <Icon aria-hidden="true" />
      </div>
      <h3 className="empty__title">{title}</h3>
      {text && <p className="empty__text">{text}</p>}
      {actions && <div className="empty__actions">{actions}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Could not load this' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="empty empty--error" role="alert">
      <div className="empty__icon">
        <AlertTriangle aria-hidden="true" />
      </div>
      <h3 className="empty__title">{title}</h3>
      <p className="empty__text">{errorMessage(error)}</p>
      {onRetry && (
        <div className="empty__actions">
          <Button onClick={onRetry}>
            <RefreshCw aria-hidden="true" /> Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', children, icon: Icon = Info }: { tone?: 'info' | 'warn' | 'danger'; children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className={`notice notice--${tone}`}>
      <Icon aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
