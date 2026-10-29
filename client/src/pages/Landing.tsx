import { ArrowRight, BarChart3, CalendarClock, FileLock2, History, KanbanSquare, Menu, Timer, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/layout/Brand';
import { ProductPreview } from '../components/ProductPreview';
import { LinkButton } from '../components/ui/Button';
import { StageBadge, usePageTitle } from '../components/ui/Bits';
import { Skeleton } from '../components/ui/Feedback';
import { STAGES } from '../lib/types';

const EdgePreviewChart = lazy(() => import('../components/EdgePreviewChart'));

const LINKS = [
  { href: '#features', label: 'Product' },
  { href: '#walkthrough', label: 'How it works' },
  { href: '#gdg-edge', label: 'GDG Edge' },
];

const FEATURES = [
  { icon: KanbanSquare, title: 'One pipeline for every application', text: 'Saved, applied, assessment, interview, offer and rejected, as a searchable table or a board you can drag across.' },
  { icon: CalendarClock, title: 'Interview rounds with outcomes', text: 'Log each round with its type, time, status and result. Booking one moves the application forward for you.' },
  { icon: Timer, title: 'Deadlines you will actually see', text: 'A calendar of rounds and due dates, plus due-soon highlighting on the dashboard and lists.' },
  { icon: FileLock2, title: 'A private resume library', text: 'Upload PDFs to a private bucket, attach the right version to each application, and open it through short-lived links.' },
  { icon: History, title: 'A history of every change', text: 'Each application keeps a timeline of stage moves, edits and interviews, so nothing is a mystery later.' },
  { icon: BarChart3, title: 'GDG Edge analytics', text: 'Interview rate, offer rate and step-by-step conversion, calculated with SQL aggregates and shown with their numerators and denominators.' },
];

export function LandingPage() {
  usePageTitle('Placement and internship tracker');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="landing">
      <a className="skip-link" href="#top">
        Skip to content
      </a>
      <header className="mnav">
        <div className="mnav__inner">
          <Brand to="/" />
          <nav className="mnav__links" aria-label="Page sections">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
            <Link to="/privacy">Privacy</Link>
          </nav>
          <div className="mnav__cta">
            <LinkButton to="/dashboard" variant="primary" size="sm">
              Open your workspace
            </LinkButton>
            <button type="button" className="btn btn--ghost btn--icon btn--sm mnav__toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
              {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-menu" className="mnav__panel" aria-label="Menu">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
            <Link to="/privacy" onClick={() => setOpen(false)}>
              Privacy
            </Link>
            <LinkButton to="/dashboard" variant="primary" block>
              Open your workspace
            </LinkButton>
          </nav>
        )}
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero__copy">
            <p className="eyebrow">Placement and internship tracker</p>
            <h1 className="hero__title">Every application, interview and offer in one calm place.</h1>
            <p className="hero__lede">
              Campus Bridge helps students track where each application stands, prepare for the next interview, and see which parts of their search are working, without a spreadsheet to babysit.
            </p>
            <div className="hero__actions">
              <LinkButton to="/dashboard" variant="primary" size="lg">
                Open your workspace <ArrowRight aria-hidden="true" />
              </LinkButton>
              <a href="#gdg-edge" className="btn btn--secondary btn--lg">
                Preview GDG Edge analytics
              </a>
            </div>
            <p className="hero__note">A working prototype. All sample figures on this page are fictional demo data.</p>
          </div>
          <div className="hero__visual">
            <ProductPreview />
          </div>
        </section>

        <section id="features" className="section">
          <div className="section__head">
            <p className="eyebrow">What it tracks</p>
            <h2 className="section__title">The parts of a placement search that usually live in five different places</h2>
          </div>
          <ul className="features">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="feature">
                <span className="feature__icon">
                  <Icon aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="walkthrough" className="section section--tint">
          <div className="section__head">
            <p className="eyebrow">How it works</p>
            <h2 className="section__title">From a saved posting to a decision you can learn from</h2>
          </div>
          <ol className="steps">
            <li className="step">
              <span className="step__n">1</span>
              <h3>Capture the role</h3>
              <p>Add the company, title, deadline and which resume you used. Only the company and title are required.</p>
              <div className="step__visual" aria-hidden="true">
                <div className="field">
                  <span className="field__label">Company</span>
                  <input className="input" value="Skyward Foundry" readOnly tabIndex={-1} />
                </div>
                <div className="field">
                  <span className="field__label">Deadline</span>
                  <input className="input" value="Fictional sample" readOnly tabIndex={-1} />
                </div>
              </div>
            </li>
            <li className="step">
              <span className="step__n">2</span>
              <h3>Move it through the pipeline</h3>
              <p>Change the stage from the table, the board or the detail page. Each move lands in the activity history.</p>
              <div className="step__visual step__visual--row" aria-hidden="true">
                {STAGES.slice(0, 5).map((s) => (
                  <StageBadge key={s} stage={s} />
                ))}
              </div>
            </li>
            <li className="step">
              <span className="step__n">3</span>
              <h3>Prepare for each round</h3>
              <p>Log phone screens, technical rounds and onsites with time, notes and result. Upcoming rounds appear on your calendar.</p>
              <div className="step__visual" aria-hidden="true">
                <div className="list-row" style={{ padding: 0, border: 0 }}>
                  <div className="date-chip">
                    <span className="date-chip__m">Nov</span>
                    <span className="date-chip__d">04</span>
                  </div>
                  <div className="list-row__main">
                    <div className="list-row__title">Technical round</div>
                    <div className="list-row__sub">11:00 · Skyward Foundry</div>
                  </div>
                  <span className="badge badge--info">Scheduled</span>
                </div>
              </div>
            </li>
            <li className="step">
              <span className="step__n">4</span>
              <h3>See what is working</h3>
              <p>GDG Edge turns your own history into conversion metrics, and always shows the counts behind each percentage.</p>
              <div className="step__visual" aria-hidden="true">
                <div className="kpi" style={{ padding: 0 }}>
                  <span className="kpi__label">Interview rate</span>
                  <span className="kpi__value">41%</span>
                  <span className="kpi__meta">11 of 27 submitted (fictional)</span>
                </div>
              </div>
            </li>
          </ol>
        </section>

        <section id="gdg-edge" className="section">
          <div className="edge">
            <div className="edge__copy">
              <p className="eyebrow">GDG Edge analytics</p>
              <h2 className="section__title">Metrics with their working shown</h2>
              <p className="muted">
                Every percentage comes from a PostgreSQL aggregate and ships with its numerator and denominator. Conversion rates use stated denominators, so a pending application is never silently counted as a loss.
              </p>
              <ul className="edge__list">
                <li>
                  <strong>Interview rate</strong> reached interview ÷ submitted
                </li>
                <li>
                  <strong>Offer rate</strong> offers ÷ submitted
                </li>
                <li>
                  <strong>Application to interview</strong> reached interview ÷ answered applications
                </li>
                <li>
                  <strong>Interview to offer</strong> offers ÷ reached interview
                </li>
              </ul>
              <LinkButton to="/analytics" variant="secondary">
                Explore the analytics workspace <ArrowRight aria-hidden="true" />
              </LinkButton>
            </div>
            <div className="card edge__chart">
              <div className="card__head">
                <div>
                  <h3 className="card__title">Application funnel</h3>
                  <p className="card__sub">Each step is a subset of the one above</p>
                </div>
                <span className="badge badge--sample">Fictional demo data</span>
              </div>
              <div className="card__body">
                <Suspense fallback={<Skeleton h={230} />}>
                  <EdgePreviewChart />
                </Suspense>
                <p className="chart-foot">Invented numbers for illustration. They do not describe any real campus, employer or student outcome.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <div>
            <Brand to="/" />
            <p className="muted footer__note">A portfolio and recruitment prototype. No partnerships, placement rates or student outcomes are claimed; all sample data is fictional.</p>
          </div>
          <nav aria-label="Footer">
            <Link to="/dashboard">Open your workspace</Link>
            <Link to="/analytics">GDG Edge analytics</Link>
            <Link to="/privacy">Privacy and data handling</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
