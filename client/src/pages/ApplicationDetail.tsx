import { ArrowLeft, CalendarPlus, Download, ExternalLink, FileText, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { InterviewDialog } from '../components/InterviewDialog';
import { Button, LinkButton } from '../components/ui/Button';
import { Card, OutcomeBadge, SampleBadge, StageBadge, usePageTitle } from '../components/ui/Bits';
import { ConfirmDialog } from '../components/ui/Dialog';
import { EmptyState, ErrorState, SkeletonCard } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';
import { ApiError, errorMessage } from '../lib/api';
import { JOB_TYPE_LABEL, ROLE_TYPE_LABEL, ROUND_LABEL, STAGE_LABEL } from '../lib/constants';
import { openResume } from '../lib/files';
import { formatDate, formatDateTime, formatTime, timeAgo } from '../lib/format';
import { useApplication, useDeleteApplication, useDeleteInterview, useMoveStage, useProfile } from '../lib/queries';
import { STAGES, type Interview, type Stage } from '../lib/types';
import { DeadlineText } from './Applications';

export function ApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: a, isLoading, error, refetch } = useApplication(id);
  usePageTitle(a ? `${a.company} - ${a.jobTitle}` : 'Application');
  const profile = useProfile();
  const move = useMoveStage();
  const del = useDeleteApplication();
  const delInterview = useDeleteInterview();

  const [interviewOpen, setInterviewOpen] = useState(false);
  const [editing, setEditing] = useState<Interview | null>(null);
  const [confirmApp, setConfirmApp] = useState(false);
  const [confirmInterview, setConfirmInterview] = useState<Interview | null>(null);
  const [fileBusy, setFileBusy] = useState<'inline' | 'attachment' | null>(null);

  if (isLoading) return <SkeletonCard h={360} label="Loading application" />;
  if (error || !a) {
    const missing = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <>
        <Link to="/applications" className="back-link">
          <ArrowLeft size={16} aria-hidden="true" /> Back to applications
        </Link>
        <div className="card">
          <ErrorState error={error} title={missing ? 'Application not found' : 'Could not load this application'} onRetry={missing ? undefined : () => refetch()} />
        </div>
      </>
    );
  }

  async function moveTo(stage: Stage) {
    if (!a || stage === a.stage) return;
    try {
      await move.mutateAsync({ id: a.id, stage });
      toast.success(`Moved to ${STAGE_LABEL[stage]}`);
    } catch (err) {
      toast.error('Could not change the stage', errorMessage(err));
    }
  }

  async function removeApplication() {
    if (!a) return;
    try {
      await del.mutateAsync(a.id);
      toast.success('Application deleted');
      navigate('/applications', { replace: true });
    } catch (err) {
      toast.error('Could not delete the application', errorMessage(err));
    }
  }

  async function removeInterview() {
    if (!confirmInterview) return;
    try {
      await delInterview.mutateAsync(confirmInterview.id);
      toast.success('Interview round removed');
      setConfirmInterview(null);
    } catch (err) {
      toast.error('Could not remove the interview', errorMessage(err));
    }
  }

  async function file(disposition: 'inline' | 'attachment') {
    if (!a?.resumeId) return;
    setFileBusy(disposition);
    try {
      await openResume(a.resumeId, disposition);
    } catch (err) {
      toast.error('Could not open the resume', errorMessage(err));
    } finally {
      setFileBusy(null);
    }
  }

  return (
    <>
      <Link to="/applications" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back to applications
      </Link>

      <header className="detail-head">
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 'var(--s-2)', marginBottom: 'var(--s-2)' }}>
            <StageBadge stage={a.stage} />
            {a.isDemo && <SampleBadge />}
          </div>
          <h1 style={{ overflowWrap: 'anywhere' }}>{a.company}</h1>
          <p className="muted" style={{ fontSize: 'var(--fs-md)' }}>
            {a.jobTitle}
          </p>
        </div>
        <div className="page-head__actions">
          <LinkButton to={`/applications/${a.id}/edit`}>
            <Pencil aria-hidden="true" /> Edit
          </LinkButton>
          <Button variant="danger-quiet" onClick={() => setConfirmApp(true)}>
            <Trash2 aria-hidden="true" /> Delete
          </Button>
        </div>
      </header>

      <div className="stack">
        <Card title="Stage" subtitle="Move this application through your pipeline.">
          <div className="stage-track" role="group" aria-label="Current stage">
            {STAGES.map((s) => (
              <button key={s} type="button" className={`stage-track__btn stage-track__btn--${s}`} aria-pressed={a.stage === s} disabled={move.isPending} onClick={() => moveTo(s)}>
                {STAGE_LABEL[s]}
              </button>
            ))}
          </div>
        </Card>

        <div className="grid-2 grid-2--wide-left">
          <div className="stack">
            <Card title="Details">
              <dl className="dl">
                <div>
                  <dt>Job type</dt>
                  <dd>{JOB_TYPE_LABEL[a.jobType]}</dd>
                </div>
                <div>
                  <dt>Role type</dt>
                  <dd>{ROLE_TYPE_LABEL[a.roleType]}</dd>
                </div>
                <div>
                  <dt>Sector</dt>
                  <dd>{a.sector}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{a.location || '-'}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{a.source || '-'}</dd>
                </div>
                <div>
                  <dt>Applied</dt>
                  <dd>{formatDate(a.appliedDate)}</dd>
                </div>
                <div>
                  <dt>Deadline</dt>
                  <dd>
                    <DeadlineText deadline={a.deadline} highlight={profile.data?.preferences.deadlineReminders ?? true} />
                  </dd>
                </div>
                <div>
                  <dt>Resume</dt>
                  <dd>
                    {a.resumeId && a.resumeName ? (
                      <span className="row" style={{ gap: 'var(--s-2)' }}>
                        <FileText size={16} aria-hidden="true" /> {a.resumeName}
                      </span>
                    ) : (
                      <span className="muted">None attached</span>
                    )}
                  </dd>
                </div>
              </dl>
              {a.resumeId && (
                <div className="row" style={{ marginTop: 'var(--s-4)' }}>
                  <Button size="sm" onClick={() => file('inline')} loading={fileBusy === 'inline'}>
                    <ExternalLink aria-hidden="true" /> Preview resume
                  </Button>
                  <Button size="sm" onClick={() => file('attachment')} loading={fileBusy === 'attachment'}>
                    <Download aria-hidden="true" /> Download
                  </Button>
                </div>
              )}
            </Card>

            <Card title="Notes">{a.notes ? <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{a.notes}</p> : <p className="muted">No notes yet. Use Edit to add some.</p>}</Card>

            <Card
              title="Interview timeline"
              subtitle={`${a.interviews.length} ${a.interviews.length === 1 ? 'round' : 'rounds'}`}
              action={
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setEditing(null);
                    setInterviewOpen(true);
                  }}
                >
                  <CalendarPlus aria-hidden="true" /> Add round
                </Button>
              }
              flush
            >
              {a.interviews.length === 0 ? (
                <EmptyState compact icon={MessageSquare} title="No interview rounds yet" text="Add a round when you get an interview invite. The application moves to Interview automatically." />
              ) : (
                <ul>
                  {a.interviews.map((i) => (
                    <li key={i.id} className="interview-row">
                      <div className="interview-row__main">
                        <div className="row" style={{ gap: 'var(--s-2)' }}>
                          <strong>{ROUND_LABEL[i.roundType]}</strong>
                          <OutcomeBadge status={i.status} outcome={i.outcome} />
                        </div>
                        <div className="muted tnum">
                          {formatDateTime(i.scheduledAt)} <span aria-hidden="true">·</span> {formatDate(i.scheduledAt.slice(0, 10))}
                        </div>
                        {i.notes && <p className="interview-row__notes">{i.notes}</p>}
                      </div>
                      <div className="row" style={{ gap: 'var(--s-1)', flexWrap: 'nowrap' }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon
                          aria-label={`Edit ${ROUND_LABEL[i.roundType]} round`}
                          onClick={() => {
                            setEditing(i);
                            setInterviewOpen(true);
                          }}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" icon aria-label={`Remove ${ROUND_LABEL[i.roundType]} round`} onClick={() => setConfirmInterview(i)}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title="Activity history" subtitle="Everything that changed, newest first">
            <ol className="timeline">
              {a.activity.map((ev) => (
                <li key={ev.id} className="timeline__item">
                  <span className={`timeline__dot ${ev.type === 'created' ? '' : ev.type === 'stage_changed' ? '' : 'timeline__dot--muted'}`} aria-hidden="true" />
                  <p className="timeline__msg">{ev.message}</p>
                  <time className="timeline__time" dateTime={ev.createdAt} title={`${formatDateTime(ev.createdAt)}`}>
                    {timeAgo(ev.createdAt)} · {formatTime(ev.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <InterviewDialog open={interviewOpen} onClose={() => setInterviewOpen(false)} applicationId={a.id} interview={editing} />

      <ConfirmDialog
        open={confirmApp}
        title="Delete this application?"
        description={
          <>
            <strong>{a.company}</strong> and its {a.interviews.length} interview {a.interviews.length === 1 ? 'round' : 'rounds'} and activity history will be permanently deleted. This cannot be undone.
          </>
        }
        confirmLabel="Delete application"
        busy={del.isPending}
        onConfirm={removeApplication}
        onCancel={() => setConfirmApp(false)}
      />
      <ConfirmDialog
        open={Boolean(confirmInterview)}
        title="Remove this interview round?"
        description="The round is deleted from the timeline and from your analytics."
        confirmLabel="Remove round"
        busy={delInterview.isPending}
        onConfirm={removeInterview}
        onCancel={() => setConfirmInterview(null)}
      />
    </>
  );
}
