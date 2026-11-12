import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate, formatDateTime, formatNav } from '@/lib/format';
import type { NavChartPoint } from '../logic';

// Single series: brand emerald for the line; recessive grid/axes in neutral tokens.
const LINE = '#0F9D83';
const GRID = '#E2E8F0';
const AXIS_TEXT = '#64748B';
const REFERENCE = '#94A3B8';

interface NavTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

function NavTooltip({ active, payload }: NavTooltipProps) {
  const p = active ? (payload?.[0]?.payload as NavChartPoint | undefined) : undefined;
  if (!p) return null;
  return (
    <div className="rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-overlay)]">
      <p className="text-muted">{formatDateTime(new Date(p.t))}</p>
      <p className="mt-0.5 num text-sm font-semibold text-ink">{formatNav(p.exact, { decimals: 4 })}</p>
    </div>
  );
}

interface NavHistoryChartProps {
  points: NavChartPoint[];
  baseNav: string;
}

/**
 * Published gross NAV per unit over time. One series → no legend (the card title names it);
 * a dashed neutral line marks the base NAV. The table below the chart is the accessible view.
 */
export function NavHistoryChart({ points, baseNav }: NavHistoryChartProps) {
  const base = Number(baseNav); // display-only
  const first = points[0];
  const last = points.at(-1);
  const summary =
    first && last
      ? `Gross NAV per unit from ${formatNav(first.exact)} on ${formatDate(new Date(first.t))} to ${formatNav(last.exact)} on ${formatDate(new Date(last.t))}, ${points.length} published values.`
      : 'No published NAV yet.';

  return (
    <figure className="m-0">
      <div role="img" aria-label={summary} className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t: number) => formatDate(new Date(t))}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              axisLine={{ stroke: GRID }}
              tickLine={false}
              minTickGap={32}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => `₹${v.toFixed(2)}`}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <ReferenceLine
              y={base}
              stroke={REFERENCE}
              strokeDasharray="4 4"
              label={{ value: 'Base NAV', position: 'insideTopLeft', fill: AXIS_TEXT, fontSize: 11 }}
            />
            <Tooltip
              content={(props) => <NavTooltip active={props.active} payload={props.payload} />}
              cursor={{ stroke: AXIS_TEXT, strokeWidth: 1 }}
            />
            <Line
              type="linear"
              dataKey="nav"
              stroke={LINE}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: '#FFFFFF', fill: LINE }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#FFFFFF', fill: LINE }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
