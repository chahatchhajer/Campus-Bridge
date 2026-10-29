import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, COLORS, axisProps } from './charts';

/** Fictional demo numbers for the landing page. Not real placement data. */
const FUNNEL = [
  { label: 'Tracked', count: 31 },
  { label: 'Submitted', count: 27 },
  { label: 'Interviewed', count: 11 },
  { label: 'Offer', count: 2 },
];

export default function EdgePreviewChart() {
  return (
    <div role="img" aria-label="Fictional demo funnel. Tracked 31, submitted 27, interviewed 11, offer 2." style={{ width: '100%', height: 230 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={FUNNEL} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }} barCategoryGap={10}>
          <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
          <XAxis type="number" allowDecimals={false} {...axisProps} />
          <YAxis type="category" dataKey="label" width={86} {...axisProps} />
          <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={<ChartTooltip series={[{ key: 'count', label: 'Applications', color: COLORS.teal }]} />} />
          <Bar dataKey="count" name="Applications" fill={COLORS.teal} radius={[0, 4, 4, 0]} maxBarSize={28}>
            <LabelList dataKey="count" position="right" fill="var(--ink)" fontSize={12} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
