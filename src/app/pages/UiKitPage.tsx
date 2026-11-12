import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  ConfirmDialog,
  DemoBadge,
  EmptyState,
  ErrorState,
  FormField,
  InfoTip,
  Input,
  Select,
  StatCard,
  Table,
  TableSkeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';
import { formatINR, formatNav, formatRateAsPercent, formatSignedINR, formatUnits } from '@/lib/format';

// Fictional sample rows for the showcase only.
const SAMPLE = [
  { name: 'Rahul Mehta (fictional)', amount: '100000', nav: '100', units: '1000', status: 'verified' },
  {
    name: 'Amit Kulkarni (fictional)',
    amount: '50000',
    nav: '105',
    units: '476.19047619',
    status: 'verified',
  },
  { name: 'Sagar Patil (fictional)', amount: '150000', nav: null, units: null, status: 'pending' },
  { name: 'Neha Joshi (fictional)', amount: '25000', nav: null, units: null, status: 'rejected' },
] as const;

const STATUS = {
  verified: { tone: 'success', label: 'Verified' },
  pending: { tone: 'warning', label: 'Pending' },
  rejected: { tone: 'danger', label: 'Rejected' },
} as const;

/** Developer-only component showcase (DEV builds only). Used to review Module 2 UI. */
export function UiKitPage() {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const amountError =
    submitted && !/^\d+(\.\d{1,2})?$/.test(amount)
      ? 'Enter an amount in rupees, e.g. 50000 or 50000.50'
      : undefined;

  return (
    <>
      <PageHeader
        title="UI kit"
        description="Developer showcase of shared components. Only available in development builds."
        badges={<DemoBadge />}
        actions={
          <>
            <Button variant="secondary">Secondary</Button>
            <Button>
              <Plus aria-hidden="true" className="size-4" />
              Primary action
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <section aria-label="Stat cards" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Verified contributions" value={formatINR('150000')} meta="2 contributions" />
          <StatCard
            label="Gross NAV"
            term="grossNav"
            value={formatNav('110.25')}
            trend={{ direction: 'up', label: '+10.25%' }}
            badge={<DemoBadge kind="manual" />}
          />
          <StatCard
            label="Outstanding units"
            term="outstandingUnits"
            value={formatUnits('1476.19047619', { decimals: 4 })}
          />
          <StatCard
            label="Unrealised P/L"
            term="unrealizedPL"
            value={formatSignedINR('-3250.5')}
            trend={{ direction: 'down', label: '-2.17%' }}
          />
          <StatCard label="Loading example" value="" loading />
        </section>

        <Card>
          <CardHeader
            title="Contributions (sample)"
            description="Table with status badges (icon + text, never colour alone)."
            actions={<Badge tone="info">Fee rate {formatRateAsPercent('0.2', { decimals: 0 })}</Badge>}
          />
          <Table caption="Sample contributions">
            <THead>
              <tr>
                <TH>Client</TH>
                <TH numeric>Amount</TH>
                <TH numeric>
                  Entry NAV <InfoTip term="nav" />
                </TH>
                <TH numeric>
                  Units <InfoTip term="units" />
                </TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {SAMPLE.map((r) => (
                <TR key={r.name}>
                  <TD className="font-medium">{r.name}</TD>
                  <TD numeric>{formatINR(r.amount)}</TD>
                  <TD numeric>{formatNav(r.nav)}</TD>
                  <TD numeric>{formatUnits(r.units)}</TD>
                  <TD>
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Form fields" description="Inline validation with accessible error wiring." />
            <CardContent>
              <form
                noValidate
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                }}
              >
                <FormField label="Amount (₹)" hint="Rupees, up to 2 decimals" required error={amountError}>
                  {(field) => (
                    <Input
                      {...field}
                      inputMode="decimal"
                      autoComplete="off"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="50000"
                    />
                  )}
                </FormField>
                <FormField label="Method">
                  {(field) => (
                    <Select {...field} defaultValue="upi">
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="other">Other</option>
                    </Select>
                  )}
                </FormField>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">Validate</Button>
                  <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
                    Open confirmation
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Buttons & feedback" />
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button>Primary</Button>
                <Button variant="navy">Navy</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button loading>Saving</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">Verified</Badge>
                <Badge tone="warning">Pending</Badge>
                <Badge tone="danger">Rejected</Badge>
                <Badge tone="info">Published</Badge>
                <Badge tone="neutral">Draft</Badge>
                <Badge tone="caution">Superseded</Badge>
                <DemoBadge />
                <DemoBadge kind="manual" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    toast({ title: 'Contribution recorded', description: 'Awaiting verification.' })
                  }
                >
                  Success toast
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    toast({ tone: 'error', title: 'Could not save', description: 'Please try again.' })
                  }
                >
                  Error toast
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Add your first client to start recording contributions."
              action={
                <Button size="sm">
                  <Plus aria-hidden="true" className="size-4" />
                  Add client
                </Button>
              }
            />
          </Card>
          <Card>
            <ErrorState onRetry={() => toast({ tone: 'info', title: 'Retrying…' })} />
          </Card>
          <Card>
            <TableSkeleton rows={6} columns={3} />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Verify contribution?"
        description="This issues units at the applicable NAV and cannot be undone. Corrections require a reversal entry."
        confirmLabel="Verify & issue units"
        requireReason
        onConfirm={async (reason) => {
          await new Promise((r) => setTimeout(r, 800));
          toast({ title: 'Contribution verified (demo)', description: `Reason: ${reason}` });
        }}
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[var(--radius-control)] bg-surface-muted p-3 text-sm">
          <dt className="text-muted">Amount</dt>
          <dd className="text-right num font-medium">{formatINR('150000')}</dd>
          <dt className="text-muted">Applicable NAV</dt>
          <dd className="text-right num font-medium">{formatNav('110')}</dd>
          <dt className="text-muted">Units to issue</dt>
          <dd className="text-right num font-medium">{formatUnits('1363.63636363')}</dd>
        </dl>
      </ConfirmDialog>
    </>
  );
}
