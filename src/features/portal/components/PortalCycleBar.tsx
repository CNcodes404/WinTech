import { Select } from '@/components/ui/Form';
import { formatDate } from '@/lib/format';
import type { ClientCycle } from '../api';

const STATUS: Record<string, string> = {
  open: 'Open',
  active: 'Active',
  closed: 'Closed',
  settled: 'Settled',
  draft: 'Draft',
};

/** Cycle name, status and period; a selector only when the client is in more than one cycle. */
export function PortalCycleBar({
  cycles,
  cycle,
  onSelect,
}: {
  cycles: ClientCycle[];
  cycle: ClientCycle;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm print:hidden">
      {cycles.length > 1 ? (
        <>
          <label htmlFor="portal-cycle" className="text-muted">
            Cycle
          </label>
          <Select
            id="portal-cycle"
            value={cycle.cycle_id}
            onChange={(e) => onSelect(e.target.value)}
            className="w-64"
          >
            {cycles.map((c) => (
              <option key={c.cycle_id} value={c.cycle_id}>
                {c.cycle_name}
              </option>
            ))}
          </Select>
        </>
      ) : (
        <span className="font-medium">{cycle.cycle_name}</span>
      )}
      <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-medium">
        {STATUS[cycle.cycle_status] ?? cycle.cycle_status}
      </span>
      <span className="num text-muted">
        {formatDate(cycle.start_date)} – {formatDate(cycle.end_date)}
      </span>
    </div>
  );
}
