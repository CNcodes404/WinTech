import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Smartphone, TriangleAlert } from 'lucide-react';
import { useEffect, useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { FormField, Input, Select, Textarea } from '@/components/ui/Form';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toast-context';
import { UserFacingError } from '@/lib/errors';
import { dateTimeLocalISTToIso, formatDateTime, formatINR, isoDateTimeLocalInIST } from '@/lib/format';
import {
  METHOD_TEXT,
  useMyPaymentRequests,
  useOpenCycles,
  useSubmitPaymentRequest,
  type PaymentRequestStatus,
} from './api';
import { PAYMENT_DETAILS, upiPayLink } from './config';

const STATUS: Record<PaymentRequestStatus, { label: string; tone: BadgeTone }> = {
  submitted: { label: 'Under review', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Not accepted', tone: 'danger' },
};

const UPI_ID = /^[A-Za-z0-9._-]{2,128}@[A-Za-z][A-Za-z0-9.-]{1,63}$/;

const schema = z
  .object({
    cycleId: z.string().min(1, 'Choose the cycle you are investing in.'),
    amount: z
      .string()
      .trim()
      .regex(/^\d{1,13}(\.\d{1,2})?$/, 'Enter the amount you paid, e.g. 50000 or 50000.50.')
      .refine((v) => Number(v) > 0, 'The amount must be greater than zero.'),
    paidAt: z.string().min(1, 'Choose when you paid.'),
    method: z.enum(['upi', 'bank_transfer']),
    payerUpiId: z.string().trim(),
    payerName: z.string().trim().max(120, 'Use at most 120 characters.'),
    transactionRef: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9-]{6,40}$/,
        'Enter the transaction ID / UTR from your payment app (6–40 letters or digits).',
      ),
    note: z.string().trim().max(500, 'Use at most 500 characters.'),
  })
  .refine((v) => v.method !== 'upi' || UPI_ID.test(v.payerUpiId), {
    path: ['payerUpiId'],
    message: 'Enter the UPI ID you paid from, e.g. name@okbank.',
  })
  .refine((v) => v.paidAt <= isoDateTimeLocalInIST(), {
    path: ['paidAt'],
    message: 'The payment time cannot be in the future.',
  });
type Values = z.infer<typeof schema>;

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function PayCard() {
  const { toast } = useToast();
  const bank = PAYMENT_DETAILS.bank;
  const hasBank = Boolean(bank.accountNumber && bank.ifsc);
  return (
    <Card className="h-fit">
      <CardHeader
        title="Step 1 · Pay WINTECH"
        description="Scan the QR code with any UPI app, or pay to the UPI ID."
      />
      <CardContent className="space-y-4">
        {PAYMENT_DETAILS.isDemo && (
          <p className="flex items-start gap-2 rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
            Demo QR code and UPI ID. Do not send real money until WINTECH shares the official payment details.
          </p>
        )}
        <div className="flex justify-center">
          <img
            src={PAYMENT_DETAILS.qrImage}
            alt={`UPI QR code to pay ${PAYMENT_DETAILS.payeeName}${PAYMENT_DETAILS.isDemo ? ' (demo)' : ''}`}
            className="size-56 rounded-2xl border border-line bg-white p-2 shadow-[var(--shadow-card)]"
            width={224}
            height={224}
          />
        </div>
        <div className="rounded-xl bg-surface-muted p-3">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">UPI ID</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="num font-semibold break-all">{PAYMENT_DETAILS.upiId}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const ok = await copy(PAYMENT_DETAILS.upiId);
                toast({ title: ok ? 'UPI ID copied' : 'Copy failed — please select and copy it manually' });
              }}
            >
              <Copy aria-hidden="true" className="size-3.5" />
              Copy
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted">Payee name: {PAYMENT_DETAILS.payeeName}</p>
        </div>
        <a
          href={upiPayLink()}
          className="flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line text-sm font-medium hover:bg-emerald-50 md:hidden"
        >
          <Smartphone aria-hidden="true" className="size-4" />
          Open a UPI app on this phone
        </a>
        {hasBank && (
          <div className="rounded-xl bg-surface-muted p-3 text-sm">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">
              Or bank transfer (NEFT / RTGS / IMPS)
            </p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-muted">Name</dt>
              <dd>{bank.accountName}</dd>
              <dt className="text-muted">Account</dt>
              <dd className="num">{bank.accountNumber}</dd>
              <dt className="text-muted">IFSC</dt>
              <dd className="num">{bank.ifsc}</dd>
              {bank.bankName && (
                <>
                  <dt className="text-muted">Bank</dt>
                  <dd>{bank.bankName}</dd>
                </>
              )}
            </dl>
          </div>
        )}
        <p className="text-xs text-muted">
          After paying, note the <strong>transaction ID / UTR</strong> shown in your payment app and fill in
          step 2.
        </p>
      </CardContent>
    </Card>
  );
}

function DetailsForm() {
  const formId = useId();
  const { toast } = useToast();
  const cycles = useOpenCycles();
  const submit = useSubmitPaymentRequest();
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      cycleId: '',
      amount: '',
      paidAt: isoDateTimeLocalInIST(),
      method: 'upi',
      payerUpiId: '',
      payerName: '',
      transactionRef: '',
      note: '',
    },
  });
  const method = useWatch({ control, name: 'method' });
  const cycleId = useWatch({ control, name: 'cycleId' });

  // Preselect the only/first open cycle.
  useEffect(() => {
    const first = cycles.data?.[0];
    if (first && !cycleId) setValue('cycleId', first.cycle_id);
  }, [cycles.data, cycleId, setValue]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await submit.mutateAsync({ ...v, paidAt: dateTimeLocalISTToIso(v.paidAt) });
      toast({
        title: 'Payment details sent',
        description: 'WINTECH will check them and add the contribution. You can follow the status below.',
      });
      reset({ ...v, amount: '', transactionRef: '', note: '', paidAt: isoDateTimeLocalInIST() });
    } catch (err) {
      setError('root', {
        message:
          err instanceof UserFacingError
            ? err.message
            : 'Your payment details could not be sent. Please try again.',
      });
    }
  });

  if (cycles.isPending) return <TableSkeleton rows={4} columns={2} />;
  if (cycles.isError)
    return <ErrorState message="Open cycles could not be loaded." onRetry={() => void cycles.refetch()} />;
  if (cycles.data.length === 0)
    return (
      <EmptyState
        title="No cycle is accepting funds right now"
        description="Please check back later or contact WINTECH."
      />
    );

  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.root?.message && (
        <p role="alert" className="rounded-[var(--radius-control)] bg-loss-soft px-3 py-2 text-sm text-loss">
          {errors.root.message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Investment cycle" required error={errors.cycleId?.message}>
          {(f) => (
            <Select {...f} {...register('cycleId')}>
              <option value="">Choose a cycle</option>
              {cycles.data.map((c) => (
                <option key={c.cycle_id} value={c.cycle_id}>
                  {c.cycle_name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Amount paid (₹)" required error={errors.amount?.message}>
          {(f) => (
            <Input
              {...f}
              {...register('amount')}
              inputMode="decimal"
              className="num"
              placeholder="e.g. 50000"
            />
          )}
        </FormField>
        <FormField label="Paid on (IST)" required error={errors.paidAt?.message}>
          {(f) => (
            <Input {...f} {...register('paidAt')} type="datetime-local" max={isoDateTimeLocalInIST()} />
          )}
        </FormField>
        <FormField label="Paid by" required>
          {(f) => (
            <Select {...f} {...register('method')}>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank transfer (NEFT / RTGS / IMPS)</option>
            </Select>
          )}
        </FormField>
        {method === 'upi' && (
          <FormField label="Your UPI ID (paid from)" required error={errors.payerUpiId?.message}>
            {(f) => <Input {...f} {...register('payerUpiId')} placeholder="name@okbank" autoComplete="off" />}
          </FormField>
        )}
        <FormField
          label="Transaction ID / UTR"
          required
          hint={
            method === 'upi'
              ? 'The 12-digit UPI reference in your app.'
              : 'The UTR / reference from your bank.'
          }
          error={errors.transactionRef?.message}
        >
          {(f) => (
            <Input {...f} {...register('transactionRef')} className="num uppercase" autoComplete="off" />
          )}
        </FormField>
        <FormField
          label="Account holder name"
          hint="Optional, if different from yours"
          error={errors.payerName?.message}
        >
          {(f) => <Input {...f} {...register('payerName')} autoComplete="name" />}
        </FormField>
      </div>
      <FormField label="Note for WINTECH" hint="Optional" error={errors.note?.message}>
        {(f) => <Textarea {...f} {...register('note')} rows={2} maxLength={500} />}
      </FormField>
      <Button type="submit" loading={isSubmitting}>
        Submit payment details
      </Button>
      <p className="text-xs text-muted">
        Units are issued only after WINTECH confirms the money has been received, at the NAV published before
        the day you paid.
      </p>
    </form>
  );
}

function MyRequests() {
  const mine = useMyPaymentRequests();
  return (
    <Card>
      <CardHeader
        title="My payment requests"
        description="Status of the payment details you have submitted."
      />
      {mine.isPending ? (
        <TableSkeleton rows={3} columns={5} />
      ) : mine.isError ? (
        <ErrorState message="Your requests could not be loaded." onRetry={() => void mine.refetch()} />
      ) : mine.data.length === 0 ? (
        <EmptyState title="No payment requests yet" description="Requests you submit appear here." />
      ) : (
        <Table caption="My payment requests" minWidth={760}>
          <THead>
            <tr>
              <TH>Paid on</TH>
              <TH>Cycle</TH>
              <TH numeric>Amount</TH>
              <TH>Method · reference</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <TBody>
            {mine.data.map((r) => (
              <TR key={r.id}>
                <TD className="num">{formatDateTime(r.paid_at)}</TD>
                <TD>{r.cycle_name}</TD>
                <TD numeric className="font-medium">
                  {formatINR(r.amount)}
                </TD>
                <TD>
                  {METHOD_TEXT[r.method]} · <span className="num">{r.transaction_ref}</span>
                  {r.payer_upi_id && <span className="block text-xs text-muted">{r.payer_upi_id}</span>}
                </TD>
                <TD>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  {r.status !== 'submitted' && r.review_reason && (
                    <span className="mt-1 block text-xs text-muted">
                      Note from WINTECH: {r.review_reason}
                    </span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

/** Client: pay by UPI QR / bank transfer, then submit the payment details for WINTECH to verify. */
export function AddFundsPage() {
  return (
    <>
      <PageHeader
        title="Add funds"
        description="Pay WINTECH by UPI or bank transfer, then send us the payment details. We verify every payment before units are issued."
      />
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <PayCard />
          <Card>
            <CardHeader
              title="Step 2 · Send your payment details"
              description="We match these with our bank statement, then add the contribution to your account."
            />
            <CardContent>
              <DetailsForm />
            </CardContent>
          </Card>
        </div>
        <MyRequests />
      </div>
    </>
  );
}
