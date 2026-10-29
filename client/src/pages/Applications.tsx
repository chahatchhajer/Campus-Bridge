import { ArrowDown, ArrowUp, ArrowUpDown, Briefcase, Eye, KanbanSquare, Pencil, Plus, Search, Table2, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SampleActions } from '../components/SampleActions';
import { Button, LinkButton } from '../components/ui/Button';
import { ActionMenu, Card, Pagination, StageBadge, useDebounced, usePageTitle, PageHeader } from '../components/ui/Bits';
import { ConfirmDialog } from '../components/ui/Dialog';
import { EmptyState, ErrorState, SkeletonRows } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../lib/api';
import { JOB_TYPE_LABEL, STAGE_LABEL } from '../lib/constants';
import { daysUntil, formatDate } from '../lib/format';
import { useApplications, useDeleteApplication, useMoveStage, useProfile, type ApplicationListParams } from '../lib/queries';
import { STAGES, type Application, type Stage } from '../lib/types';

export function DeadlineText({ deadline, highlight = true }: { deadline: string | null; highlight?: boolean }) {
  if (!deadline) return <span className="muted">-</span>;
  const n = daysUntil(deadline);
  const soon = highlight && n >= 0 && n <= 3;
  return (
    <span className={soon ? 'deadline--soon' : n < 0 ? 'muted' : undefined} title={n < 0 ? 'Deadline passed' : undefined}>
      {formatDate(deadline)}
      {soon && <span className="sr-only"> (due soon)</span>}
    </span>
  );
}

type SortKey = 'company' | 'stage' | 'appliedDate' | 'deadline' | 'updatedAt';

export function ApplicationsPage() {
  usePageTitle('Applications');
  const toast = useToast();
  const navigate = useNavigate();
  const profile = useProfile();
  const [sp, setSp] = useSearchParams();

  const view = (sp.get('view') as 'table' | 'board' | null) ?? profile.data?.preferences.defaultView ?? 'table';
  const [searchText, setSearchText] = useState(sp.get('q') ?? '');
  const debounced = useDebounced(searchText);

  const stage = (sp.get('stage') ?? '') as Stage | '';
  const jobType = sp.get('jobType') ?? '';
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  const sort = (sp.get('sort') as SortKey | null) ?? 'updatedAt';
  const order = (sp.get('order') as 'asc' | 'desc' | null) ?? 'desc';
  const page = Number(sp.get('page') ?? 1) || 1;

  const setParam = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (resetPage) next.delete('page');
    setSp(next, { replace: true });
  };

  // Debounced search text -> URL param. Keyed on the debounced value only, so "Clear" can't be undone by a stale value.
  useEffect(() => {
    if (debounced !== (sp.get('q') ?? '')) setParam({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const params: ApplicationListParams = useMemo(
    () => ({
      search: sp.get('q') ?? '',
      stage: view === 'board' ? '' : stage,
      jobType,
      from,
      to,
      sort,
      order,
      page: view === 'board' ? 1 : page,
      pageSize: view === 'board' ? 100 : 15,
    }),
    [sp, view, stage, jobType, from, to, sort, order, page],
  );

  const { data, isLoading, isFetching, error, refetch } = useApplications(params);
  const move = useMoveStage();
  const del = useDeleteApplication();
  const [toDelete, setToDelete] = useState<Application | null>(null);

  const filtersActive = Boolean(sp.get('q') || stage || jobType || from || to);
  const clearFilters = () => {
    setSearchText('');
    const next = new URLSearchParams();
    if (sp.get('view')) next.set('view', sp.get('view')!);
    setSp(next, { replace: true });
  };

  async function moveTo(app: Application, next: Stage) {
    if (next === app.stage) return;
    try {
      await move.mutateAsync({ id: app.id, stage: next });
      toast.success(`${app.company} moved to ${STAGE_LABEL[next]}`);
    } catch (err) {
      toast.error('Could not move the application', errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success('Application deleted', `${toDelete.company} and its interviews were removed.`);
      setToDelete(null);
    } catch (err) {
      toast.error('Could not delete the application', errorMessage(err));
    }
  }

  const sortHeader = (key: SortKey, label: string) => {
    const active = sort === key;
    const Icon = !active ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th scope="col" aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" className="th-sort" onClick={() => setParam({ sort: key, order: active && order === 'asc' ? 'desc' : 'asc' })}>
          {label}
          <Icon aria-hidden="true" />
        </button>
      </th>
    );
  };

  const rows = data?.rows ?? [];
  const meta = data?.meta;

  return (
    <>
      <PageHeader
        title="Applications"
        description="Search, filter and move applications through your pipeline."
        actions={
          <>
            <div className="segmented" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'table'} onClick={() => setParam({ view: 'table' }, false)}>
                <Table2 aria-hidden="true" /> Table
              </button>
              <button type="button" aria-pressed={view === 'board'} onClick={() => setParam({ view: 'board' }, false)}>
                <KanbanSquare aria-hidden="true" /> Board
              </button>
            </div>
            <LinkButton to="/applications/new" variant="primary">
              <Plus aria-hidden="true" /> New application
            </LinkButton>
          </>
        }
      />

      <div className="card filters" role="search" aria-label="Filter applications">
        <div className="input-icon filters__search">
          <Search aria-hidden="true" />
          <input className="input" type="search" placeholder="Search company or role" aria-label="Search by company or role" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        {view === 'table' && (
          <select className="select" aria-label="Filter by stage" value={stage} onChange={(e) => setParam({ stage: e.target.value })}>
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        )}
        <select className="select" aria-label="Filter by job type" value={jobType} onChange={(e) => setParam({ jobType: e.target.value })}>
          <option value="">All job types</option>
          {Object.entries(JOB_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="filters__date">
          <span>From</span>
          <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setParam({ from: e.target.value })} />
        </label>
        <label className="filters__date">
          <span>To</span>
          <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setParam({ to: e.target.value })} />
        </label>
        {filtersActive && (
          <Button variant="ghost" onClick={clearFilters}>
            <X aria-hidden="true" /> Clear
          </Button>
        )}
      </div>
      <p className="muted filters__hint">Date filters use the applied date (or the date saved, for applications not yet submitted).</p>

      <div style={{ marginTop: 'var(--s-4)' }} aria-busy={isFetching}>
        {isLoading ? (
          <Card flush>
            <SkeletonRows rows={6} label="Loading applications" />
          </Card>
        ) : error ? (
          <div className="card">
            <ErrorState error={error} onRetry={refetch} title="Could not load applications" />
          </div>
        ) : rows.length === 0 ? (
          <div className="card">
            {filtersActive ? (
              <EmptyState
                icon={Search}
                title="No applications match these filters"
                text="Try a different search term or widen the date range."
                actions={
                  <Button onClick={clearFilters}>
                    <X aria-hidden="true" /> Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Briefcase}
                title="No applications yet"
                text="Add your first application, or load fictional sample data to see how the pipeline, calendar and analytics work."
                actions={
                  <>
                    <LinkButton to="/applications/new" variant="primary">
                      <Plus aria-hidden="true" /> New application
                    </LinkButton>
                    <SampleActions />
                  </>
                }
              />
            )}
          </div>
        ) : view === 'table' ? (
          <div className="card">
            <div className="table-wrap table-only">
              <table className="table">
                <caption className="sr-only">Applications</caption>
                <thead>
                  <tr>
                    {sortHeader('company', 'Company and role')}
                    {sortHeader('stage', 'Stage')}
                    <th scope="col">Type</th>
                    {sortHeader('appliedDate', 'Applied')}
                    {sortHeader('deadline', 'Deadline')}
                    <th scope="col" className="num">
                      Rounds
                    </th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link to={`/applications/${a.id}`} className="row-title">
                          {a.company}
                        </Link>
                        <div className="row-sub">
                          {a.jobTitle}
                          {a.isDemo && ' · sample'}
                        </div>
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`stage-${a.id}`}>
                          Stage for {a.company}
                        </label>
                        <select id={`stage-${a.id}`} className="select select--inline" value={a.stage} onChange={(e) => moveTo(a, e.target.value as Stage)}>
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {STAGE_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{JOB_TYPE_LABEL[a.jobType]}</td>
                      <td className="tnum">{formatDate(a.appliedDate)}</td>
                      <td className="tnum">
                        <DeadlineText deadline={a.deadline} highlight={profile.data?.preferences.deadlineReminders ?? true} />
                      </td>
                      <td className="num">{a.interviewCount ?? 0}</td>
                      <td>
                        <RowMenu app={a} onDelete={() => setToDelete(a)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="card-list cards-only">
              {rows.map((a) => (
                <li key={a.id} className="app-card">
                  <div className="row row--between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <Link to={`/applications/${a.id}`} className="row-title">
                        {a.company}
                      </Link>
                      <div className="row-sub">{a.jobTitle}</div>
                    </div>
                    <RowMenu app={a} onDelete={() => setToDelete(a)} />
                  </div>
                  <div className="row" style={{ gap: 'var(--s-2)' }}>
                    <StageBadge stage={a.stage} />
                    <span className="badge badge--plain">{JOB_TYPE_LABEL[a.jobType]}</span>
                    {a.isDemo && <span className="badge badge--sample">Sample</span>}
                  </div>
                  <dl className="app-card__meta">
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
                  </dl>
                  <label className="field">
                    <span className="field__label">Move to stage</span>
                    <select className="select" value={a.stage} onChange={(e) => moveTo(a, e.target.value as Stage)}>
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {STAGE_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
            {meta && <Pagination meta={meta} label="applications" onPage={(p) => setParam({ page: String(p) }, false)} />}
          </div>
        ) : (
          <>
            <Board rows={rows} onMove={moveTo} onOpen={(id) => navigate(`/applications/${id}`)} highlight={profile.data?.preferences.deadlineReminders ?? true} />
            {meta && meta.total > rows.length && <p className="muted" style={{ marginTop: 'var(--s-3)' }}>Showing the first {rows.length} of {meta.total} applications. Use filters to narrow the board.</p>}
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this application?"
        description={
          <>
            <strong>{toDelete?.company}</strong> ({toDelete?.jobTitle}) will be permanently deleted along with its interview rounds and activity history. This cannot be undone.
          </>
        }
        confirmLabel="Delete application"
        busy={del.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

function RowMenu({ app, onDelete }: { app: Application; onDelete: () => void }) {
  const navigate = useNavigate();
  return (
    <ActionMenu label={`Actions for ${app.company}`}>
      {(close) => (
        <>
          <button type="button" className="menu__item" onClick={() => navigate(`/applications/${app.id}`)}>
            <Eye aria-hidden="true" /> View details
          </button>
          <button type="button" className="menu__item" onClick={() => navigate(`/applications/${app.id}/edit`)}>
            <Pencil aria-hidden="true" /> Edit
          </button>
          <button
            type="button"
            className="menu__item menu__item--danger"
            onClick={() => {
              close();
              onDelete();
            }}
          >
            <Trash2 aria-hidden="true" /> Delete
          </button>
        </>
      )}
    </ActionMenu>
  );
}

function Board({ rows, onMove, onOpen, highlight }: { rows: Application[]; onMove: (a: Application, s: Stage) => void; onOpen: (id: string) => void; highlight: boolean }) {
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGES.map((s) => [s, [] as Application[]])) as Record<Stage, Application[]>;
    rows.forEach((a) => m[a.stage].push(a));
    return m;
  }, [rows]);

  return (
    <div className="board" role="list" aria-label="Pipeline board">
      {STAGES.map((s) => (
        <section
          key={s}
          role="listitem"
          aria-label={`${STAGE_LABEL[s]}, ${byStage[s].length} applications`}
          className={`board__col ${dragOver === s ? 'board__col--over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(s);
          }}
          onDragLeave={() => setDragOver((cur) => (cur === s ? null : cur))}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(null);
            const app = rows.find((r) => r.id === e.dataTransfer.getData('text/plain'));
            if (app) onMove(app, s);
          }}
        >
          <header className="board__head">
            <StageBadge stage={s} />
            <span className="muted tnum">{byStage[s].length}</span>
          </header>
          <ul className="board__cards">
            {byStage[s].length === 0 && <li className="board__empty">Drop an application here</li>}
            {byStage[s].map((a) => (
              <li key={a.id} className="board-card" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', a.id)}>
                <button type="button" className="board-card__open" onClick={() => onOpen(a.id)}>
                  <span className="row-title">{a.company}</span>
                  <span className="row-sub truncate">{a.jobTitle}</span>
                </button>
                <div className="board-card__meta">
                  <span>{JOB_TYPE_LABEL[a.jobType]}</span>
                  {a.deadline && (
                    <span>
                      Due <DeadlineText deadline={a.deadline} highlight={highlight} />
                    </span>
                  )}
                </div>
                <label className="sr-only" htmlFor={`bm-${a.id}`}>
                  Move {a.company} to stage
                </label>
                <select id={`bm-${a.id}`} className="select select--inline" value={a.stage} onChange={(e) => onMove(a, e.target.value as Stage)}>
                  {STAGES.map((st) => (
                    <option key={st} value={st}>
                      Move to: {STAGE_LABEL[st]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
