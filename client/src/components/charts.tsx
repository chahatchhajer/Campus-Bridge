import { Table2, BarChart3 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Card } from './ui/Bits';

export type Series = { key: string; label: string; color: string };

/** Fixed series colors; each entity keeps its color regardless of filters. */
export const COLORS = {
  teal: 'var(--chart-1)',
  blue: 'var(--chart-2)',
  amber: 'var(--chart-3)',
  red: 'var(--chart-4)',
  neutral: 'var(--chart-neutral)',
};

export const axisProps = {
  stroke: 'var(--chart-axis)',
  tick: { fill: 'var(--chart-axis)', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: 'var(--line-strong)' },
} as const;

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="chart-legend" aria-label="Legend">
      {series.map((s) => (
        <li key={s.key}>
          <span className="chart-legend__swatch" style={{ background: s.color }} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

type TipProps = {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string; payload?: Record<string, unknown> }[];
  label?: string | number;
  labelFormatter?: (l: string | number) => string;
  series?: Series[];
};

/** Tooltip in the app's own surface style; text uses ink tokens, a swatch carries identity. */
export function ChartTooltip({ active, payload, label, labelFormatter, series }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label !== undefined && <div className="chart-tip__title">{labelFormatter ? labelFormatter(label) : String(label)}</div>}
      {payload.map((p) => {
        const s = series?.find((x) => x.key === p.dataKey);
        return (
          <div key={String(p.dataKey)} className="chart-tip__row">
            <span className="chart-legend__swatch" style={{ background: s?.color ?? p.color }} aria-hidden="true" />
            <span>{s?.label ?? p.name}</span>
            <strong className="tnum">{p.value}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function DataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="table-wrap">
      <table className="table table--compact">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} scope="col" className={i > 0 ? 'num' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (chip(ci, cell)))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const chip = (ci: number, cell: string | number) =>
  ci === 0 ? (
    <th key={ci} scope="row" className="row-head">
      {cell}
    </th>
  ) : (
    <td key={ci} className="num">
      {cell}
    </td>
  );

type ChartCardProps = {
  title: string;
  subtitle?: ReactNode;
  /** One-sentence plain-language summary for screen readers (the chart itself is an image to them). */
  summary: string;
  series?: Series[];
  chart: ReactNode;
  table: { caption: string; columns: string[]; rows: (string | number)[][] };
  empty?: boolean;
  emptyText?: string;
  footnote?: ReactNode;
};

export function ChartCard({ title, subtitle, summary, series, chart, table, empty, emptyText, footnote }: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const regionId = useId();
  return (
    <Card
      title={title}
      subtitle={subtitle}
      action={
        !empty && (
          <div className="segmented" role="group" aria-label={`${title} view`}>
            <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>
              <BarChart3 aria-hidden="true" /> Chart
            </button>
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>
              <Table2 aria-hidden="true" /> Table
            </button>
          </div>
        )
      }
    >
      {empty ? (
        <p className="muted chart-empty">{emptyText ?? 'No data for the selected filters.'}</p>
      ) : view === 'chart' ? (
        <div id={regionId}>
          {series && <Legend series={series} />}
          <div className="chart-box" role="img" aria-label={`${title}. ${summary}`}>
            {chart}
          </div>
        </div>
      ) : (
        <DataTable {...table} />
      )}
      {footnote && !empty && <p className="chart-foot">{footnote}</p>}
    </Card>
  );
}
