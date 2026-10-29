import { BarChart3, Briefcase, FlaskConical, Handshake, Percent, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SampleActions } from '../components/SampleActions';
import { ChartCard, ChartTooltip, COLORS, DataTable, axisProps, type Series } from '../components/charts';
import { Card, Kpi, PageHeader, SampleBadge, usePageTitle } from '../components/ui/Bits';
import { EmptyState, ErrorState, Notice, SkeletonCard } from '../components/ui/Feedback';
import { JOB_TYPE_LABEL, ROLE_TYPE_LABEL, ROUND_LABEL } from '../lib/constants';
import { formatMonthKey, formatPercent, toDateInput } from '../lib/format';
import { useAnalyticsBreakdowns, useAnalyticsFunnel, useAnalyticsMonthly, useAnalyticsSummary } from '../lib/queries';
import type { AnalyticsFilters, JobType, Metric } from '../lib/types';

type Preset = 'all' | '90d' | '12m' | 'custom';

const truncate = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const ofText = (m: Metric, noun: string) => (m.denominator === 0 ? `No ${noun} yet` : `${m.numerator} of ${m.denominator} ${noun}`);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function AnalyticsPage() {
  usePageTitle('GDG Edge analytics');
  const [preset, setPreset] = useState<Preset>('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [jobType, setJobType] = useState<JobType | ''>('');

  const filters: AnalyticsFilters = useMemo(() => {
    const today = new Date();
    if (preset === '90d') {
      const d = new Date(today);
      d.setDate(d.getDate() - 90);
      return { from: toDateInput(d), jobType };
    }
    if (preset === '12m') {
      const d = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      return { from: toDateInput(d), jobType };
    }
    if (preset === 'custom') return { from: custom.from || undefined, to: custom.to || undefined, jobType };
    return { jobType };
  }, [preset, custom, jobType]);

  const rangeInvalid = preset === 'custom' && custom.from !== '' && custom.to !== '' && custom.from > custom.to;
  const effective = rangeInvalid ? { jobType } : filters;

  const summary = useAnalyticsSummary(effective);
  const funnel = useAnalyticsFunnel(effective);
  const monthly = useAnalyticsMonthly(effective);
  const breakdowns = useAnalyticsBreakdowns(effective);

  const firstError = summary.error ?? funnel.error ?? monthly.error ?? breakdowns.error;
  const loading = summary.isLoading || funnel.isLoading || monthly.isLoading || breakdowns.isLoading;
  const s = summary.data;
  const filtered = preset !== 'all' || jobType !== '';

  const header = (
    <PageHeader
      eyebrow="GDG Edge"
      title="Analytics"
      description="Funnel, conversion and outcome metrics computed with SQL aggregates over your own applications."
    />
  );

  const filterBar = (
    <div className="card filters filters--analytics" role="group" aria-label="Analytics filters">
      <div className="segmented" role="group" aria-label="Date range">
        {(
          [
            ['all', 'All time'],
            ['90d', 'Last 90 days'],
            ['12m', 'Last 12 months'],
            ['custom', 'Custom'],
          ] as [Preset, string][]
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={preset === k} onClick={() => setPreset(k)}>
            {label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <>
          <label className="filters__date">
            <span>From</span>
            <input className="input" type="date" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-invalid={rangeInvalid || undefined} />
          </label>
          <label className="filters__date">
            <span>To</span>
            <input className="input" type="date" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-invalid={rangeInvalid || undefined} />
          </label>
        </>
      )}
      <select className="select" aria-label="Job type" value={jobType} onChange={(e) => setJobType(e.target.value as JobType | '')}>
        <option value="">All job types</option>
        {Object.entries(JOB_TYPE_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );

  if (loading)
    return (
      <>
        {header}
        {filterBar}
        <div className="kpi-grid kpi-grid--5" style={{ marginTop: 'var(--s-4)' }} role="status" aria-label="Loading analytics">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} h={28} />
          ))}
        </div>
        <div className="grid-2" style={{ marginTop: 'var(--s-5)' }}>
          <SkeletonCard h={260} />
          <SkeletonCard h={260} />
        </div>
      </>
    );

  if (firstError || !s || !funnel.data || !monthly.data || !breakdowns.data)
    return (
      <>
        {header}
        {filterBar}
        <div className="card" style={{ marginTop: 'var(--s-4)' }}>
          <ErrorState
            error={firstError}
            title="Could not load analytics"
            onRetry={() => {
              summary.refetch();
              funnel.refetch();
              monthly.refetch();
              breakdowns.refetch();
            }}
          />
        </div>
      </>
    );

  const b = breakdowns.data;
  const noData = s.totalApplications === 0;

  if (noData && !filtered)
    return (
      <>
        {header}
        <div className="card">
          <EmptyState
            icon={BarChart3}
            title="No data to analyse yet"
            text="Analytics are calculated from your applications. Add a few, or load the clearly labelled fictional sample data to explore this page."
            actions={<SampleActions />}
          />
        </div>
      </>
    );

  const reached = funnel.data.reached;
  const stepPct = (i: number) => (i === 0 || reached[i - 1].count === 0 ? '-' : formatPercent(Math.round((1000 * reached[i].count) / reached[i - 1].count) / 10));

  const monthlySeries: Series[] = [
    { key: 'applications', label: 'Applications tracked', color: COLORS.blue },
    { key: 'interviewed', label: 'Reached interview', color: COLORS.teal },
    { key: 'offers', label: 'Offers', color: COLORS.amber },
  ];
  const roleSeries: Series[] = [
    { key: 'offers', label: 'Offer', color: COLORS.teal },
    { key: 'inProgress', label: 'In progress', color: COLORS.blue },
    { key: 'rejected', label: 'Rejected', color: COLORS.red },
    { key: 'saved', label: 'Saved', color: COLORS.neutral },
  ];
  const sectorSeries: Series[] = [
    { key: 'total', label: 'Tracked', color: COLORS.blue },
    { key: 'interviewed', label: 'Reached interview', color: COLORS.teal },
    { key: 'offers', label: 'Offer', color: COLORS.amber },
  ];

  const roleData = b.roleType.map((r) => ({ ...r, name: ROLE_TYPE_LABEL[r.roleType] }));
  const sectorData = b.sector.slice(0, 8);
  const o = b.interviewOutcomes;
  const outcomeData = [
    { name: 'Passed', value: o.passed, color: COLORS.teal },
    { name: 'Not selected', value: o.failed, color: COLORS.red },
    { name: 'Awaiting result', value: o.awaiting, color: COLORS.amber },
    { name: 'Scheduled', value: o.scheduled, color: COLORS.blue },
    { name: 'Cancelled', value: o.cancelled, color: COLORS.neutral },
  ];
  const outcomeTotal = sum(outcomeData.map((d) => d.value));
  const stageData = funnel.data.currentStage;
  const monthSummary = monthly.data.length ? `${monthly.data.length} months from ${formatMonthKey(monthly.data[0].month)} to ${formatMonthKey(monthly.data[monthly.data.length - 1].month)}; ${sum(monthly.data.map((m) => m.applications))} applications in total.` : 'No months.';

  return (
    <>
      {header}
      {filterBar}
      {rangeInvalid && (
        <div style={{ marginTop: 'var(--s-3)' }}>
          <Notice tone="warn">The start date is after the end date, so the range filter is ignored until you fix it.</Notice>
        </div>
      )}

      <div className="stack" style={{ marginTop: 'var(--s-4)' }}>
        {s.sampleData.sampleApplications > 0 && (
          <Notice tone="warn" icon={FlaskConical}>
            <strong>Fictional sample data.</strong> {s.sampleData.sampleApplications} of the {s.sampleData.totalApplications} applications in this view are invented sample records, so these figures illustrate how analytics work and say nothing about real placement outcomes. Remove them in <Link to="/settings">Settings</Link>.
          </Notice>
        )}

        {noData ? (
          <div className="card">
            <EmptyState compact icon={BarChart3} title="No applications match these filters" text="Widen the date range or choose a different job type." />
          </div>
        ) : (
          <>
            <div className="kpi-grid kpi-grid--5">
              <Kpi icon={Briefcase} label="Total applications" value={s.totalApplications} meta={`${s.submitted} submitted, ${s.totalApplications - s.submitted} saved`} />
              <Kpi icon={Percent} label="Interview rate" value={formatPercent(s.interviewRate.percent)} meta={ofText(s.interviewRate, 'submitted reached interview')} />
              <Kpi icon={Trophy} label="Offer rate" value={formatPercent(s.offerRate.percent)} meta={ofText(s.offerRate, 'submitted got an offer')} />
              <Kpi icon={Handshake} label="Application to interview" value={formatPercent(s.applicationToInterview.percent)} meta={ofText(s.applicationToInterview, 'answered reached interview')} />
              <Kpi icon={Handshake} label="Interview to offer" value={formatPercent(s.interviewToOffer.percent)} meta={ofText(s.interviewToOffer, 'interviewed got an offer')} />
            </div>

            <div className="grid-2">
              <ChartCard
                title="Application funnel"
                subtitle="How far applications got. Each step is a subset of the one above."
                summary={reached.map((r) => `${r.label} ${r.count}`).join(', ')}
                chart={
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={reached} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }} barCategoryGap={10}>
                      <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                      <XAxis type="number" allowDecimals={false} {...axisProps} />
                      <YAxis type="category" dataKey="label" width={86} {...axisProps} />
                      <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={<ChartTooltip series={[{ key: 'count', label: 'Applications', color: COLORS.teal }]} />} />
                      <Bar dataKey="count" name="Applications" fill={COLORS.teal} radius={[0, 4, 4, 0]} maxBarSize={28}>
                        <LabelList dataKey="count" position="right" fill="var(--ink)" fontSize={12} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                }
                table={{ caption: 'Application funnel', columns: ['Step', 'Applications', 'Of previous step'], rows: reached.map((r, i) => [r.label, r.count, stepPct(i)]) }}
                footnote="Tracked = everything you added. Submitted = past Saved. Reached interview includes rejected applications that had interviews."
              />

              <ChartCard
                title="Applications by month"
                subtitle="By applied date (saved date for unsubmitted)"
                series={monthlySeries}
                summary={monthSummary}
                empty={monthly.data.length === 0}
                chart={
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={monthly.data} margin={{ left: -12, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="month" tickFormatter={formatMonthKey} {...axisProps} interval="preserveStartEnd" minTickGap={12} />
                      <YAxis allowDecimals={false} {...axisProps} />
                      <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={<ChartTooltip labelFormatter={(l) => formatMonthKey(String(l))} series={monthlySeries} />} />
                      <Bar dataKey="applications" name="Applications tracked" fill={COLORS.blue} radius={[4, 4, 0, 0]} maxBarSize={26} />
                      <Line type="monotone" dataKey="interviewed" name="Reached interview" stroke={COLORS.teal} strokeWidth={2} dot={{ r: 4, fill: COLORS.teal, stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="offers" name="Offers" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 4, fill: COLORS.amber, stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                }
                table={{ caption: 'Applications by month', columns: ['Month', 'Tracked', 'Submitted', 'Reached interview', 'Offers'], rows: monthly.data.map((m) => [formatMonthKey(m.month), m.applications, m.submitted, m.interviewed, m.offers]) }}
              />
            </div>

            <div className="grid-2">
              <ChartCard
                title="Outcomes by role type"
                subtitle="Where each role type's applications stand now"
                series={roleSeries}
                summary={roleData.map((r) => `${r.name}: ${r.offers} offers, ${r.inProgress} in progress, ${r.rejected} rejected, ${r.saved} saved`).join('; ')}
                empty={roleData.length === 0}
                chart={
                  <ResponsiveContainer width="100%" height={Math.max(220, roleData.length * 48 + 40)}>
                    <BarChart data={roleData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }} barCategoryGap={10}>
                      <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                      <XAxis type="number" allowDecimals={false} {...axisProps} />
                      <YAxis type="category" dataKey="name" width={92} {...axisProps} />
                      <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={<ChartTooltip series={roleSeries} />} />
                      {roleSeries.map((sr, i) => (
                        <Bar key={sr.key} dataKey={sr.key} name={sr.label} stackId="role" fill={sr.color} stroke="var(--surface)" strokeWidth={2} radius={i === roleSeries.length - 1 ? [0, 4, 4, 0] : 0} maxBarSize={28} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                }
                table={{ caption: 'Outcomes by role type', columns: ['Role type', 'Offer', 'In progress', 'Rejected', 'Saved', 'Total'], rows: roleData.map((r) => [r.name, r.offers, r.inProgress, r.rejected, r.saved, r.total]) }}
              />

              <ChartCard
                title="Interview outcomes"
                subtitle="Every recorded round"
                summary={outcomeData.map((d) => `${d.name} ${d.value}`).join(', ')}
                empty={outcomeTotal === 0}
                emptyText="No interview rounds recorded for these filters."
                chart={
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={outcomeData} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }} barCategoryGap={10}>
                      <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                      <XAxis type="number" allowDecimals={false} {...axisProps} />
                      <YAxis type="category" dataKey="name" width={104} {...axisProps} />
                      <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={<ChartTooltip series={[{ key: 'value', label: 'Rounds', color: COLORS.teal }]} />} />
                      <Bar dataKey="value" name="Rounds" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {outcomeData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                        <LabelList dataKey="value" position="right" fill="var(--ink)" fontSize={12} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                }
                table={{ caption: 'Interview outcomes', columns: ['Outcome', 'Rounds'], rows: outcomeData.map((d) => [d.name, d.value]) }}
                footnote={`Pass rate: ${ofText(o.passRate, 'rounds with a result passed')} (${formatPercent(o.passRate.percent)}). Cancelled and not-yet-decided rounds are excluded.`}
              />
            </div>

            <div className="grid-2">
              <ChartCard
                title="Sector breakdown"
                subtitle="Top sectors by applications tracked"
                series={sectorSeries}
                summary={sectorData.map((x) => `${x.sector}: ${x.total} tracked, ${x.interviewed} reached interview, ${x.offers} offers`).join('; ')}
                empty={sectorData.length === 0}
                chart={
                  <ResponsiveContainer width="100%" height={Math.max(240, sectorData.length * 56 + 40)}>
                    <BarChart data={sectorData} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }} barCategoryGap={12} barGap={2}>
                      <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                      <XAxis type="number" allowDecimals={false} {...axisProps} />
                      <YAxis type="category" dataKey="sector" width={96} tickFormatter={(v: string) => truncate(v, 14)} {...axisProps} />
                      <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={<ChartTooltip series={sectorSeries} />} />
                      <Bar dataKey="total" name="Tracked" fill={COLORS.blue} radius={[0, 4, 4, 0]} maxBarSize={14} />
                      <Bar dataKey="interviewed" name="Reached interview" fill={COLORS.teal} radius={[0, 4, 4, 0]} maxBarSize={14} />
                      <Bar dataKey="offers" name="Offer" fill={COLORS.amber} radius={[0, 4, 4, 0]} maxBarSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                }
                table={{ caption: 'Sector breakdown', columns: ['Sector', 'Tracked', 'Submitted', 'Reached interview', 'Offers'], rows: b.sector.map((x) => [x.sector, x.total, x.submitted, x.interviewed, x.offers]) }}
              />

              <ChartCard
                title="Current stage"
                subtitle="Where applications sit right now"
                summary={stageData.map((d) => `${d.label} ${d.count}`).join(', ')}
                chart={
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stageData} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }} barCategoryGap={10}>
                      <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                      <XAxis type="number" allowDecimals={false} {...axisProps} />
                      <YAxis type="category" dataKey="label" width={86} {...axisProps} />
                      <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={<ChartTooltip series={[{ key: 'count', label: 'Applications', color: COLORS.blue }]} />} />
                      <Bar dataKey="count" name="Applications" fill={COLORS.blue} radius={[0, 4, 4, 0]} maxBarSize={26}>
                        <LabelList dataKey="count" position="right" fill="var(--ink)" fontSize={12} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                }
                table={{ caption: 'Applications by current stage', columns: ['Stage', 'Applications'], rows: stageData.map((d) => [d.label, d.count]) }}
              />
            </div>

            <Card title="Pass rate by interview round" subtitle="Rounds with a recorded result (cancelled and pending rounds excluded)" flush>
              {b.interviewRounds.length === 0 ? (
                <p className="muted chart-empty">No interview rounds recorded for these filters.</p>
              ) : (
                <DataTable
                  caption="Pass rate by interview round"
                  columns={['Round', 'Rounds', 'Passed', 'Not selected', 'Pass rate']}
                  rows={b.interviewRounds.map((r) => [ROUND_LABEL[r.roundType], r.total, r.passed, r.failed, r.passRate.denominator ? `${formatPercent(r.passRate.percent)} (${r.passRate.numerator}/${r.passRate.denominator})` : 'n/a'])}
                />
              )}
            </Card>

            <Card title="How these metrics are defined">
              <dl className="defs">
                <div>
                  <dt>Submitted</dt>
                  <dd>Applications past the Saved stage.</dd>
                </div>
                <div>
                  <dt>Reached interview</dt>
                  <dd>Submitted applications with at least one interview round, or at the Interview or Offer stage. Applications later rejected still count.</dd>
                </div>
                <div>
                  <dt>Interview rate</dt>
                  <dd>Reached interview ÷ submitted.</dd>
                </div>
                <div>
                  <dt>Offer rate</dt>
                  <dd>Offers ÷ submitted.</dd>
                </div>
                <div>
                  <dt>Application to interview</dt>
                  <dd>Reached interview ÷ answered applications (reached interview, offer or rejected). Applications still waiting to hear back are left out instead of being counted as failures.</dd>
                </div>
                <div>
                  <dt>Interview to offer</dt>
                  <dd>Offers ÷ reached interview.</dd>
                </div>
                <div>
                  <dt>Empty denominators</dt>
                  <dd>Shown as n/a, never 0%, because no data is not the same as a zero result.</dd>
                </div>
                <div>
                  <dt>Dates</dt>
                  <dd>Filters and months use the applied date, or the date saved for applications not yet submitted.</dd>
                </div>
              </dl>
              {s.sampleData.sampleApplications > 0 && (
                <p style={{ marginTop: 'var(--s-4)' }}>
                  <SampleBadge /> Sample records are included in every figure above.
                </p>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
