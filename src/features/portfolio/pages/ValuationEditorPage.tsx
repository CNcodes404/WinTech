import { ChevronLeft, Info } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useCycle } from '@/features/cycles/queries';
import { formatDateTime } from '@/lib/format';
import { isUuid } from '@/lib/utils/uuid';
import { ValuationEditor } from '../components/ValuationEditor';
import { toFormValues } from '../formValues';
import { useValuation, useValuations } from '../queries';

/**
 * /admin/portfolio/valuations/new?cycle=…            new (pre-filled from the latest approved valuation)
 * /admin/portfolio/valuations/new?cycle=…&corrects=… correction of an approved valuation
 * /admin/portfolio/valuations/:valuationId/edit      edit a draft
 */
export function ValuationEditorPage() {
  const { valuationId = '' } = useParams();
  const [sp] = useSearchParams();
  const editing = isUuid(valuationId);
  const correctsId = !editing && isUuid(sp.get('corrects') ?? '') ? sp.get('corrects')! : null;

  const draft = useValuation(editing ? valuationId : '');
  const cycleId = editing ? (draft.data?.valuation.cycle_id ?? '') : (sp.get('cycle') ?? '');
  const cycle = useCycle(cycleId);
  const list = useValuations(!editing && !correctsId ? cycleId : '');
  const latestApprovedId = list.data?.find((v) => v.status === 'approved')?.id ?? '';
  const sourceId = correctsId ?? latestApprovedId;
  const source = useValuation(!editing ? sourceId : '');

  const back = (
    <Link
      to={`/admin/portfolio?cycle=${cycleId}`}
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      Portfolio
    </Link>
  );

  if (!editing && !isUuid(cycleId)) {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            title="Choose a cycle first"
            description="Open Portfolio and pick the cycle to value."
          />
        </Card>
      </>
    );
  }

  const loading =
    (editing && draft.isPending) ||
    cycle.isPending ||
    (!editing && !correctsId && list.isPending) ||
    (!editing && isUuid(sourceId) && source.isPending);
  if (loading) {
    return (
      <LoadingRegion label="Loading valuation">
        {back}
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-6 h-64" />
      </LoadingRegion>
    );
  }
  if (draft.isError || cycle.isError || list.isError || source.isError || !cycle.data) {
    return (
      <>
        {back}
        <Card>
          <ErrorState message="The valuation editor could not be loaded." />
        </Card>
      </>
    );
  }
  if (editing && (!draft.data || draft.data.valuation.status !== 'draft')) {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            title="This valuation cannot be edited"
            description="Only drafts are editable. Approved valuations are fixed; create a correction instead."
          />
        </Card>
      </>
    );
  }

  const initial = editing
    ? toFormValues(draft.data!, { keepTime: true })
    : toFormValues(source.data ?? null, { keepTime: Boolean(correctsId) });

  const banner = correctsId
    ? `Correcting the approved valuation of ${formatDateTime(source.data?.valuation.valuation_at)}. When approved, it replaces the original (which is kept as superseded).`
    : !editing && source.data
      ? `Pre-filled from the latest approved valuation (${formatDateTime(source.data.valuation.valuation_at)}). Update prices, cash and liabilities before saving.`
      : null;

  return (
    <>
      {back}
      <PageHeader
        title={editing ? 'Edit valuation draft' : correctsId ? 'Correct valuation' : 'New valuation'}
        description="Manual demo entry. Not live market data. No buy or sell orders are placed."
      />
      {banner && (
        <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-info-soft px-3 py-2 text-sm text-info">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {banner}
        </p>
      )}
      <ValuationEditor
        cycleId={cycleId}
        cycleName={cycle.data.name}
        valuationId={editing ? valuationId : null}
        correctsId={correctsId}
        initial={initial}
      />
    </>
  );
}
