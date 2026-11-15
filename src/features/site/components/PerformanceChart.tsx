import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatINR, formatSignedPercent } from '@/lib/format';
import { GROWTH, START_VALUE, STRATEGIES, type GrowthPoint, type Strategy } from '../performance';

const GRID = '#E2E8F0';
const AXIS = '#64748B';

const inr = (v: number) => formatINR(v, { decimals: 0 });
const lakh = (v: number) => `₹${(v / 100000).toFixed(1)}L`;

function GrowthTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}) {
  const p = active ? (payload?.[0]?.payload as GrowthPoint | undefined) : undefined;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-[var(--shadow-overlay)]">
      <p className="font-semibold text-muted">{p.label}</p>
      {STRATEGIES.map((s) => (
        <p key={s.key} className="mt-1 flex items-center gap-2 text-ink">
          <span aria-hidden="true" className="h-0.5 w-3 rounded" style={{ background: s.color }} />
          {s.name}: <span className="num font-semibold">{inr(p[s.key])}</span>
        </p>
      ))}
    </div>
  );
}

/** Growth of ₹1,00,000 for both strategies over the last 5 years (one shared ₹ axis). */
export function GrowthChart() {
  const last = GROWTH.at(-1)!;
  const summary = `Growth of ₹1,00,000 from ${GROWTH[0]!.label} to ${last.label}: ${STRATEGIES.map(
    (s) => `${s.name} ${inr(last[s.key])}`,
  ).join(', ')}. Illustrative mock data.`;
  return (
    <figure className="m-0">
      <div role="img" aria-label={summary} className="h-72 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={GROWTH} margin={{ top: 16, right: 24, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="label"
              interval={11}
              tick={{ fill: AXIS, fontSize: 12 }}
              axisLine={{ stroke: GRID }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={lakh}
              domain={['dataMin - 5000', 'dataMax + 5000']}
              tick={{ fill: AXIS, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <ReferenceLine
              y={START_VALUE}
              stroke="#94A3B8"
              strokeDasharray="4 4"
              label={{ value: 'Invested ₹1L', position: 'insideBottomLeft', fill: AXIS, fontSize: 11 }}
            />
            <Tooltip
              content={(props) => <GrowthTooltip active={props.active} payload={props.payload} />}
              cursor={{ stroke: AXIS, strokeWidth: 1 }}
            />
            {STRATEGIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff', fill: s.color }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

/** Return of each cycle, one small chart per strategy on the same % scale. */
export function CycleReturnsChart() {
  const all = STRATEGIES.flatMap((s) => s.cycles.map((c) => c.ret));
  const max = Math.ceil((Math.max(...all) * 100 + 5) / 10) * 10;
  const min = Math.min(0, Math.floor((Math.min(...all) * 100 - 5) / 10) * 10);
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_5fr]">
      {STRATEGIES.map((s) => (
        <CycleBars key={s.key} strategy={s} domain={[min, max]} />
      ))}
    </div>
  );
}

function CycleBars({ strategy: s, domain }: { strategy: Strategy; domain: [number, number] }) {
  const data = s.cycles.map((c) => ({
    name: c.label.replace(/ – /, '–').replace(/Dec |Nov /g, ''),
    full: c.label,
    pct: Number((c.ret * 100).toFixed(1)),
    inProgress: Boolean(c.inProgress),
  }));
  const summary = `${s.name} return per cycle: ${s.cycles
    .map(
      (c) =>
        `${c.label} ${formatSignedPercent(c.ret, { decimals: 1 })}${c.inProgress ? ' (in progress)' : ''}`,
    )
    .join('; ')}. Illustrative mock data.`;
  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: s.color }} />
        {s.name} · {s.cycleLength}
      </figcaption>
      <div role="img" aria-label={summary} className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <pattern
                id={`hatch-${s.key}`}
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill={s.color} fillOpacity="0.35" />
                <line x1="0" y1="0" x2="0" y2="6" stroke={s.color} strokeWidth="3" />
              </pattern>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: AXIS, fontSize: 11 }}
              axisLine={{ stroke: GRID }}
              tickLine={false}
            />
            <YAxis
              domain={domain}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fill: AXIS, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <ReferenceLine y={0} stroke="#94A3B8" />
            <Tooltip
              cursor={{ fill: 'rgb(148 163 184 / 0.12)' }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined;
                if (!p) return null;
                return (
                  <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-[var(--shadow-overlay)]">
                    <p className="font-semibold text-muted">{p.full}</p>
                    <p className="mt-1 num text-sm font-semibold text-ink">
                      {p.pct > 0 ? '+' : ''}
                      {p.pct.toFixed(1)}%{p.inProgress ? ' so far (in progress)' : ''}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.inProgress ? `url(#hatch-${s.key})` : s.color} />
              ))}
              <LabelList
                dataKey="pct"
                position="top"
                formatter={(v: unknown) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(1)}%`}
                style={{ fill: '#172338', fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
