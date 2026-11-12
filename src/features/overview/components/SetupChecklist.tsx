import { CircleCheck, Circle } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardHeader } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';

interface Step {
  label: string;
  done: boolean;
  href: string;
}

/** First-run guide: the order in which the demo workflow has to be set up. */
export function SetupChecklist({ steps }: { steps: Step[] }) {
  const next = steps.findIndex((s) => !s.done);
  return (
    <Card>
      <CardHeader title="Get started" description="Set up the demo workflow in this order." />
      <ol className="divide-y divide-line">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3 px-5 py-3">
            {s.done ? (
              <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-gain" />
            ) : (
              <Circle
                aria-hidden="true"
                className={cn('size-5 shrink-0', i === next ? 'text-emerald-500' : 'text-line')}
              />
            )}
            <span className={cn('flex-1 text-sm', s.done && 'text-muted line-through')}>
              <span className="sr-only">{s.done ? 'Done: ' : 'To do: '}</span>
              {s.label}
            </span>
            {!s.done && i === next && (
              <Link to={s.href} className="text-sm font-medium text-emerald-700 hover:underline">
                Start
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
