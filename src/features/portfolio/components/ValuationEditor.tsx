import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useFieldArray, useForm, useWatch, type FieldError } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { FormField, Input, Select, Textarea } from '@/components/ui/Form';
import { useToast } from '@/components/ui/toast-context';
import { InfoTip } from '@/components/ui/Tooltip';
import { useCycleUnitSummary } from '@/features/contributions/queries';
import { UserFacingError } from '@/lib/errors';
import {
  dateTimeLocalISTToIso,
  formatINR,
  formatNav,
  formatUnits,
  isoDateTimeLocalInIST,
} from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { previewValuation } from '../logic';
import { useSaveValuationDraft } from '../queries';
import { emptyHolding, valuationSchema, type ValuationFormInput, type ValuationFormValues } from '../schemas';

interface ValuationEditorProps {
  cycleId: string;
  cycleName: string;
  valuationId: string | null;
  correctsId: string | null;
  initial: ValuationFormInput;
}

function CellError({ id, error }: { id: string; error?: FieldError }) {
  if (!error?.message) return null;
  return (
    <p id={id} className="mt-1 text-xs font-medium text-loss">
      {error.message}
    </p>
  );
}

/** Desktop-first holdings editor with a live (preview-only) totals panel. */
export function ValuationEditor({
  cycleId,
  cycleName,
  valuationId,
  correctsId,
  initial,
}: ValuationEditorProps) {
  const formId = useId();
  const navigate = useNavigate();
  const { toast } = useToast();
  const save = useSaveValuationDraft();
  const units = useCycleUnitSummary(cycleId);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ValuationFormInput, unknown, ValuationFormValues>({
    resolver: zodResolver(valuationSchema),
    defaultValues: initial,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'holdings' });
  const [holdings, cash, other, liabilities] = useWatch({
    control,
    name: ['holdings', 'cashBalance', 'otherAssets', 'liabilities'],
  });
  const preview = previewValuation(
    holdings ?? [],
    cash ?? '',
    other ?? '',
    liabilities ?? '',
    units.data?.outstanding_units,
  );

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      const id = await save.mutateAsync({
        valuationId,
        cycleId,
        valuationAt: dateTimeLocalISTToIso(v.valuationAt),
        cashBalance: v.cashBalance,
        otherAssets: v.otherAssets,
        liabilities: v.liabilities,
        notes: v.notes,
        correctsId,
        items: v.holdings.map((h) => ({
          symbol: h.symbol,
          instrument_name: h.instrumentName,
          exchange: h.exchange,
          quantity: h.quantity,
          valuation_price: h.valuationPrice,
          average_cost: h.averageCost,
          notes: h.notes,
        })),
      });
      toast({ title: 'Draft saved', description: 'Review the totals, then approve it.' });
      navigate(`/admin/portfolio/valuations/${id}`);
    } catch (err) {
      setFormError(
        err instanceof UserFacingError ? err.message : 'The valuation could not be saved. Please try again.',
      );
    }
  });

  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-6">
        {formError && (
          <p
            role="alert"
            className="rounded-[var(--radius-control)] border border-loss/20 bg-loss-soft px-3 py-2 text-sm text-loss"
          >
            {formError}
          </p>
        )}

        <Card>
          <CardHeader
            title="Valuation details"
            description={`Cycle: ${cycleName}`}
            actions={<DemoBadge kind="manual" />}
          />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Valuation date & time (IST)" required error={errors.valuationAt?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...register('valuationAt')}
                  type="datetime-local"
                  max={isoDateTimeLocalInIST()}
                />
              )}
            </FormField>
            <FormField label="Notes" hint="Optional, e.g. price source" error={errors.notes?.message}>
              {(field) => <Textarea {...field} {...register('notes')} rows={1} maxLength={2000} />}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Holdings"
            description="Enter quantity and the valuation price per unit. Market value = quantity × price."
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => append(emptyHolding())}
                disabled={fields.length >= 200}
              >
                <Plus aria-hidden="true" className="size-4" />
                Add holding
              </Button>
            }
          />
          {fields.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">
              No holdings. A valuation can also consist of cash only.{' '}
              <button
                type="button"
                className="font-medium text-emerald-700 hover:underline"
                onClick={() => append(emptyHolding())}
              >
                Add a holding
              </button>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div
                  className="grid grid-cols-[2.5rem_8rem_1fr_6rem_8rem_8rem_8rem_8rem_2.5rem] gap-2 border-b border-line bg-surface-muted px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase"
                  aria-hidden="true"
                >
                  <span>#</span>
                  <span>Symbol</span>
                  <span>Name</span>
                  <span>Exchange</span>
                  <span className="text-right">Quantity</span>
                  <span className="text-right">Price (₹)</span>
                  <span className="text-right">Avg cost (₹)</span>
                  <span className="text-right">Market value</span>
                  <span />
                </div>
                <ol className="divide-y divide-line">
                  {fields.map((f, i) => {
                    const e = errors.holdings?.[i];
                    const n = i + 1;
                    const err = (k: string) => `${f.id}-${k}-error`;
                    return (
                      <li
                        key={f.id}
                        className="grid grid-cols-[2.5rem_8rem_1fr_6rem_8rem_8rem_8rem_8rem_2.5rem] items-start gap-2 px-4 py-2"
                      >
                        <span className="pt-2.5 num text-sm text-muted">{n}</span>
                        <div>
                          <Input
                            {...register(`holdings.${i}.symbol`)}
                            aria-label={`Line ${n} symbol`}
                            aria-describedby={e?.symbol ? err('symbol') : undefined}
                            invalid={Boolean(e?.symbol)}
                            className="uppercase"
                            autoComplete="off"
                          />
                          <CellError id={err('symbol')} error={e?.symbol} />
                        </div>
                        <div>
                          <Input
                            {...register(`holdings.${i}.instrumentName`)}
                            aria-label={`Line ${n} instrument name`}
                            invalid={Boolean(e?.instrumentName)}
                            autoComplete="off"
                          />
                          <CellError id={err('name')} error={e?.instrumentName} />
                        </div>
                        <Select {...register(`holdings.${i}.exchange`)} aria-label={`Line ${n} exchange`}>
                          <option value="NSE">NSE</option>
                          <option value="BSE">BSE</option>
                          <option value="OTHER">Other</option>
                          <option value="">—</option>
                        </Select>
                        <div>
                          <Input
                            {...register(`holdings.${i}.quantity`)}
                            aria-label={`Line ${n} quantity`}
                            aria-describedby={e?.quantity ? err('qty') : undefined}
                            invalid={Boolean(e?.quantity)}
                            inputMode="decimal"
                            className="text-right num"
                          />
                          <CellError id={err('qty')} error={e?.quantity} />
                        </div>
                        <div>
                          <Input
                            {...register(`holdings.${i}.valuationPrice`)}
                            aria-label={`Line ${n} valuation price`}
                            aria-describedby={e?.valuationPrice ? err('price') : undefined}
                            invalid={Boolean(e?.valuationPrice)}
                            inputMode="decimal"
                            className="text-right num"
                          />
                          <CellError id={err('price')} error={e?.valuationPrice} />
                        </div>
                        <div>
                          <Input
                            {...register(`holdings.${i}.averageCost`)}
                            aria-label={`Line ${n} average cost (optional)`}
                            invalid={Boolean(e?.averageCost)}
                            inputMode="decimal"
                            className="text-right num"
                          />
                          <CellError id={err('avg')} error={e?.averageCost} />
                        </div>
                        <output
                          className={cn(
                            'pt-2.5 text-right num text-sm font-medium',
                            !preview.lineValues[i] && 'text-muted',
                          )}
                          aria-label={`Line ${n} market value`}
                        >
                          {preview.lineValues[i] ? formatINR(preview.lineValues[i]) : '—'}
                        </output>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(i)}
                          aria-label={`Remove line ${n}`}
                          className="h-10 w-10 text-muted hover:text-loss"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Cash and liabilities" />
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField label="Cash balance (₹)" error={errors.cashBalance?.message}>
              {(field) => (
                <Input {...field} {...register('cashBalance')} inputMode="decimal" className="num" />
              )}
            </FormField>
            <FormField
              label="Other assets (₹)"
              hint="Only if explicitly modelled"
              error={errors.otherAssets?.message}
            >
              {(field) => (
                <Input {...field} {...register('otherAssets')} inputMode="decimal" className="num" />
              )}
            </FormField>
            <FormField
              label="Liabilities (₹)"
              hint="Brokerage, taxes, accrued expenses, payables"
              error={errors.liabilities?.message}
            >
              {(field) => (
                <Input {...field} {...register('liabilities')} inputMode="decimal" className="num" />
              )}
            </FormField>
          </CardContent>
        </Card>
      </div>

      <aside aria-label="Valuation totals (preview)" className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader
            title="Totals"
            description="Live preview. Recalculated by the server when saved."
            as="h3"
          />
          <CardContent>
            <dl className="space-y-2 text-sm">
              {[
                ['Holdings value', formatINR(preview.holdings)],
                ['+ Cash', formatINR(preview.cash)],
                ['+ Other assets', formatINR(preview.other)],
                ['= Gross assets', formatINR(preview.grossAssets)],
                ['− Liabilities', formatINR(preview.liabilities)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="num">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-line pt-2">
                <dt className="font-medium">Net asset value</dt>
                <dd className={cn('num font-semibold', preview.netAssets.isNegative() && 'text-loss')}>
                  {formatINR(preview.netAssets)}
                </dd>
              </div>
            </dl>
            <div className="mt-4 rounded-[var(--radius-control)] bg-surface-muted p-3 text-xs text-muted">
              <p className="flex items-center gap-1">
                Outstanding units <InfoTip term="outstandingUnits" />:{' '}
                <span className="num text-ink">
                  {formatUnits(units.data?.outstanding_units ?? '0', { decimals: 4 })}
                </span>
              </p>
              {preview.navPerUnit ? (
                <p className="mt-1">
                  Indicative gross NAV per unit:{' '}
                  <span className="num font-medium text-ink">{formatNav(preview.navPerUnit)}</span>
                  <span className="block">
                    Preview only. The official NAV is calculated when NAV is published.
                  </span>
                </p>
              ) : (
                <p className="mt-1">No units issued yet, so no NAV per unit can be shown.</p>
              )}
            </div>
            <Button type="submit" form={formId} className="mt-4 w-full" loading={isSubmitting}>
              Save draft
            </Button>
            <p className="mt-2 text-center text-xs text-muted">Drafts can be edited until approved.</p>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
