import { ChevronLeft, ChevronRight, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { INTERVIEW_STATUS_LABEL, OUTCOME_LABEL, STAGE_LABEL } from '../../lib/constants';
import type { InterviewOutcome, InterviewStatus, PageMeta, Stage } from '../../lib/types';
import { Button } from './Button';

export const StageBadge = ({ stage }: { stage: Stage }) => <span className={`badge badge--${stage}`}>{STAGE_LABEL[stage]}</span>;

export function OutcomeBadge({ status, outcome }: { status: InterviewStatus; outcome: InterviewOutcome }) {
  if (status === 'cancelled') return <span className="badge badge--plain">{INTERVIEW_STATUS_LABEL.cancelled}</span>;
  if (outcome === 'passed') return <span className="badge badge--ok">{OUTCOME_LABEL.passed}</span>;
  if (outcome === 'failed') return <span className="badge badge--danger">{OUTCOME_LABEL.failed}</span>;
  return <span className={`badge ${status === 'scheduled' ? 'badge--info' : 'badge--warn'}`}>{status === 'scheduled' ? 'Scheduled' : 'Awaiting result'}</span>;
}

export const SampleBadge = () => <span className="badge badge--sample">Fictional sample</span>;

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="page-head">
      <div className="page-head__text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted page-head__desc">{description}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, subtitle, action, children, flush, id, className = '' }: { title?: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean; id?: string; className?: string }) {
  return (
    <section className={`card ${className}`} id={id} aria-label={title}>
      {(title || action) && (
        <div className="card__head">
          <div>
            {title && <h2 className="card__title">{title}</h2>}
            {subtitle && <p className="card__sub">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={`card__body ${flush ? 'card__body--flush' : ''}`} style={flush && title ? { paddingTop: 'var(--s-3)' } : undefined}>
        {children}
      </div>
    </section>
  );
}

export function Kpi({ icon: Icon, label, value, suffix, meta, to }: { icon: LucideIcon; label: string; value: string | number; suffix?: string; meta?: ReactNode; to?: string }) {
  const body = (
    <>
      <span className="kpi__label">
        <Icon aria-hidden="true" />
        {label}
      </span>
      <span className="kpi__value">
        {value}
        {suffix && <small> {suffix}</small>}
      </span>
      {meta && <span className="kpi__meta">{meta}</span>}
    </>
  );
  return to ? (
    <Link to={to} className="card kpi">
      {body}
    </Link>
  ) : (
    <div className="card kpi">{body}</div>
  );
}

export function Pagination({ meta, onPage, label = 'results' }: { meta: PageMeta; onPage: (p: number) => void; label?: string }) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.total, meta.page * meta.pageSize);
  return (
    <nav className="pagination" aria-label="Pagination">
      <span aria-live="polite">
        {from}-{to} of {meta.total} {label}
      </span>
      <div className="pagination__nav">
        <Button size="sm" variant="secondary" onClick={() => onPage(meta.page - 1)} disabled={meta.page <= 1} aria-label="Previous page">
          <ChevronLeft aria-hidden="true" /> Prev
        </Button>
        <span className="tnum">
          Page {meta.page} of {meta.totalPages}
        </span>
        <Button size="sm" variant="secondary" onClick={() => onPage(meta.page + 1)} disabled={meta.page >= meta.totalPages} aria-label="Next page">
          Next <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

/** Small action menu (disclosure pattern): closes on outside click and Escape. */
export function ActionMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <Button variant="ghost" size="sm" icon aria-label={label} aria-haspopup="true" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal aria-hidden="true" />
      </Button>
      {open && (
        <div className="menu__panel" id={id}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} - Campus Bridge`;
  }, [title]);
}
