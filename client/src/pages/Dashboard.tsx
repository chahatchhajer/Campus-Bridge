import { ArrowRight, Briefcase, CalendarClock, CalendarDays, Gift, Plus, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SampleActions } from '../components/SampleActions';
import { LinkButton } from '../components/ui/Button';
import { Card, Kpi, PageHeader, StageBadge, usePageTitle } from '../components/ui/Bits';
import { EmptyState, ErrorState, Skeleton, SkeletonCard } from '../components/ui/Feedback';
import { ROUND_LABEL, STAGE_LABEL } from '../lib/constants';
import { daysUntil, formatDateShort, formatTime, formatWeekday, relativeDay, timeAgo } from '../lib/format';
import { useDashboard, useProfile } from '../lib/queries';
import { STAGES, type Stage } from '../lib/types';

export function PipelineBar({ counts, total }: { counts: Record<Stage, number>; total: number }) {
  return (
    <div>
      <div className="stagebar" role="img" aria-label={`Pipeline: ${STAGES.map((s) => `${counts[s]} ${STAGE_LABEL[s]}`).join(', ')}`}>
        {STAGES.filter((s) => counts[s] > 0).map((s) => (
          <span key={s} className={`seg--${s}`} style={{ flex: counts[s] }} />
        ))}
      </div>
      <ul className="legend-grid">
        {STAGES.map((s) => (
          <li key={s}>
            <Link to={`/applications?stage=${s}`} className="legend-link">
              <span className={`legend-dot seg--${s}`} aria-hidden="true" />
              <span>{STAGE_LABEL[s]}</span>
              <strong className="tnum">{counts[s]}</strong>
            </Link>
          </li>
        ))}
      </ul>
      {total === 0 && <p className="muted">Nothing in the pipeline yet.</p>}
    </div>
  );
}

export function DashboardPage() {
  usePageTitle('Dashboard');
  const { data, isLoading, error, refetch } = useDashboard();
  const profile = useProfile();
  const first = profile.data?.fullName.split(' ')[0];

  const header = (
    <PageHeader
      title={first ? `Welcome back, ${first}` : 'Dashboard'}
      description="Where your applications, interviews and deadlines stand today."
      actions={
        <LinkButton to="/applications/new" variant="primary">
          <Plus aria-hidden="true" /> New application
        </LinkButton>
      }
    />
  );

  if (isLoading)
    return (
      <>
        {header}
        <div className="kpi-grid" role="status" aria-label="Loading dashboard">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card kpi">
              <Skeleton w="60%" />
              <Skeleton w="40%" h={32} />
            </div>
          ))}
        </div>
        <div className="grid-2" style={{ marginTop: 'var(--s-5)' }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </>
    );
  if (error || !data)
    return (
      <>
        {header}
        <ErrorState error={error} onRetry={refetch} title="Could not load your dashboard" />
      </>
    );

  const { kpis, stageCounts, upcomingInterviews, upcomingDeadlines, recentActivity } = data;

  if (kpis.totalApplications === 0)
    return (
      <>
        {header}
        <div className="card">
          <EmptyState
            icon={Briefcase}
            title="Start tracking your first application"
            text="Add an application to see your pipeline, interviews and deadlines here. Or explore the workspace with clearly labelled fictional data first."
            actions={
              <>
                <LinkButton to="/applications/new" variant="primary">
                  <Plus aria-hidden="true" /> New application
                </LinkButton>
                <SampleActions />
              </>
            }
          />
        </div>
      </>
    );

  return (
    <>
      {header}
      <div className="stack">
        <div className="kpi-grid">
          <Kpi icon={Briefcase} label="Active applications" value={kpis.activeApplications} meta="Applied, assessment or interview" to="/applications" />
          <Kpi icon={CalendarClock} label="Upcoming interviews" value={kpis.upcomingInterviews} meta="Scheduled from now on" to="/calendar" />
          <Kpi icon={Gift} label="Offers" value={kpis.offers} meta={`${kpis.totalApplications} applications tracked`} to="/applications?stage=offer" />
          <Kpi icon={Timer} label="Deadlines, next 14 days" value={kpis.deadlinesNext14Days} meta="Excluding rejected" to="/calendar" />
        </div>

        <div className="grid-2">
          <Card title="Upcoming interviews" subtitle="Next scheduled rounds" action={<Link to="/calendar" className="card-link">Calendar <ArrowRight size={14} aria-hidden="true" /></Link>} flush>
            {upcomingInterviews.length === 0 ? (
              <EmptyState compact icon={CalendarDays} title="No interviews scheduled" text="Add an interview round from an application's page." />
            ) : (
              <ul>
                {upcomingInterviews.map((i) => (
                  <li key={i.id}>
                    <Link to={`/applications/${i.applicationId}`} className="list-row">
                      <div className="date-chip" aria-hidden="true">
                        <span className="date-chip__m">{new Date(i.scheduledAt).toLocaleString(undefined, { month: 'short' })}</span>
                        <span className="date-chip__d">{new Date(i.scheduledAt).getDate()}</span>
                      </div>
                      <div className="list-row__main">
                        <div className="list-row__title truncate">{i.company}</div>
                        <div className="list-row__sub truncate">
                          {ROUND_LABEL[i.roundType]} round · {formatWeekday(i.scheduledAt)} {formatTime(i.scheduledAt)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Application pipeline" subtitle={`${kpis.totalApplications} applications by current stage`}>
            <PipelineBar counts={stageCounts} total={kpis.totalApplications} />
          </Card>
        </div>

        <div className="grid-2">
          <Card title="Upcoming deadlines" subtitle="Soonest first" flush>
            {upcomingDeadlines.length === 0 ? (
              <EmptyState compact icon={Timer} title="No upcoming deadlines" text="Set a deadline on an application to see it here." />
            ) : (
              <ul>
                {upcomingDeadlines.map((d) => (
                  <li key={d.id}>
                    <Link to={`/applications/${d.id}`} className="list-row">
                      <div className="list-row__main">
                        <div className="list-row__title truncate">{d.company}</div>
                        <div className="list-row__sub truncate">{d.jobTitle}</div>
                      </div>
                      <StageBadge stage={d.stage} />
                      <div className={`deadline ${daysUntil(d.deadline) <= 3 ? 'deadline--soon' : ''}`}>
                        <span>{formatDateShort(d.deadline)}</span>
                        <span className="list-row__sub">{relativeDay(d.deadline)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Recent activity" subtitle="Latest changes across your applications" flush>
            <ul>
              {recentActivity.map((a) => (
                <li key={a.id}>
                  <Link to={`/applications/${a.applicationId}`} className="list-row">
                    <div className="list-row__main">
                      <div className="truncate">
                        <strong>{a.company}</strong> <span className="muted">{a.message}</span>
                      </div>
                      <div className="list-row__sub">{timeAgo(a.createdAt)}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
