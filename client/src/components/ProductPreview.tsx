import { Briefcase, CalendarClock, CalendarDays, FileText, Gift, LayoutDashboard, Timer, BarChart3 } from 'lucide-react';
import { BrandMark } from './layout/Brand';
import { StageBadge } from './ui/Bits';
import type { Stage } from '../lib/types';

/**
 * A miniature of the real dashboard, assembled from the same CSS and components as the app.
 * Everything shown is fictional and labelled as such. Nothing here is live data.
 */
const KPIS = [
  { icon: Briefcase, label: 'Active applications', value: '6' },
  { icon: CalendarClock, label: 'Upcoming interviews', value: '3' },
  { icon: Gift, label: 'Offers', value: '1' },
  { icon: Timer, label: 'Deadlines, 14 days', value: '4' },
];

const INTERVIEWS = [
  { m: 'Nov', d: '04', company: 'Skyward Foundry', sub: 'Technical round · Tue 11:00' },
  { m: 'Nov', d: '07', company: 'Pebble Education', sub: 'Behavioral round · Fri 14:00' },
  { m: 'Nov', d: '12', company: 'Kestrel Aerospace Labs', sub: 'Onsite · Wed 09:00' },
];


const PIPE: { s: Stage; n: number }[] = [
  { s: 'saved', n: 3 },
  { s: 'applied', n: 5 },
  { s: 'assessment', n: 2 },
  { s: 'interview', n: 3 },
  { s: 'offer', n: 1 },
  { s: 'rejected', n: 12 },
];

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Briefcase, label: 'Applications' },
  { icon: CalendarDays, label: 'Calendar' },
  { icon: FileText, label: 'Resumes' },
  { icon: BarChart3, label: 'GDG Edge' },
];

export function ProductPreview() {
  return (
    <figure className="preview" aria-label="Illustration of the Campus Bridge dashboard using fictional sample data">
      <div className="preview__frame">
        <div className="preview__bar" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="preview__body">
          <aside className="preview__side" aria-hidden="true">
            <div className="brand" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--s-4)' }}>
              <BrandMark size={22} /> Campus Bridge
            </div>
            {NAV.map(({ icon: Icon, label, active }) => (
              <div key={label} className={`nav-link ${active ? 'active' : ''}`} style={{ minHeight: '2rem', fontSize: 'var(--fs-sm)' }}>
                <Icon aria-hidden="true" /> {label}
              </div>
            ))}
          </aside>
          <div className="preview__main">
            <div className="row row--between" style={{ marginBottom: 'var(--s-3)', flexWrap: 'nowrap' }}>
              <strong style={{ fontSize: 'var(--fs-md)' }}>Dashboard</strong>
              <span className="badge badge--sample">Fictional sample data</span>
            </div>
            <div className="preview__kpis">
              {KPIS.map(({ icon: Icon, label, value }, i) => (
                <div key={label} className={`card kpi ${i > 1 ? 'preview__hide-sm' : ''}`}>
                  <span className="kpi__label">
                    <Icon aria-hidden="true" />
                    {label}
                  </span>
                  <span className="kpi__value">{value}</span>
                </div>
              ))}
            </div>
            <div className="preview__panels">
              <div className="card">
                <div className="card__head" style={{ padding: 'var(--s-3) var(--s-4) 0' }}>
                  <h3 className="card__title" style={{ fontSize: 'var(--fs-base)' }}>
                    Upcoming interviews
                  </h3>
                </div>
                <ul>
                  {INTERVIEWS.map((i) => (
                    <li key={i.company} className="list-row" style={{ padding: 'var(--s-2) var(--s-4)' }}>
                      <div className="date-chip" aria-hidden="true">
                        <span className="date-chip__m">{i.m}</span>
                        <span className="date-chip__d">{i.d}</span>
                      </div>
                      <div className="list-row__main">
                        <div className="list-row__title truncate">{i.company}</div>
                        <div className="list-row__sub truncate">{i.sub}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card preview__hide-sm">
                <div className="card__head" style={{ padding: 'var(--s-3) var(--s-4) 0' }}>
                  <h3 className="card__title" style={{ fontSize: 'var(--fs-base)' }}>
                    Pipeline
                  </h3>
                </div>
                <div className="card__body" style={{ padding: 'var(--s-3) var(--s-4) var(--s-4)' }}>
                  <div className="stagebar" aria-hidden="true">
                    {PIPE.map((p) => (
                      <span key={p.s} className={`seg--${p.s}`} style={{ flex: p.n }} />
                    ))}
                  </div>
                  <ul className="preview__apps">
                    {PIPE.filter((p) => p.s !== 'saved').map((p) => (
                      <li key={p.s}>
                        <StageBadge stage={p.s} />
                        <strong className="tnum">{p.n}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="preview__cap">Illustration built from the app's own components. Companies and numbers are fictional.</figcaption>
    </figure>
  );
}
