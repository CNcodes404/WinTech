import { Inbox, Mail, Phone } from 'lucide-react';
import { useId, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { FormField, Select, Textarea } from '@/components/ui/Form';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/toast-context';
import { ENQUIRY_INTERESTS } from '@/features/site/content';
import { useEnquiries, useSetEnquiryStatus, type Enquiry, type EnquiryStatus } from '@/features/site/api';
import { UserFacingError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

const STATUS: Record<EnquiryStatus, { label: string; tone: BadgeTone }> = {
  new: { label: 'New', tone: 'info' },
  contacted: { label: 'Contacted', tone: 'warning' },
  closed: { label: 'Closed', tone: 'neutral' },
};

const interestLabel = (v: string) => ENQUIRY_INTERESTS.find((i) => i.value === v)?.label ?? v;

function UpdateDialog({ enquiry, onClose }: { enquiry: Enquiry; onClose: () => void }) {
  const formId = useId();
  const update = useSetEnquiryStatus();
  const { toast } = useToast();
  const [status, setStatus] = useState<EnquiryStatus>(
    enquiry.status === 'new' ? 'contacted' : enquiry.status,
  );
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !update.isPending && onClose()}
      title={`Update enquiry from ${enquiry.full_name}`}
      description="Status changes are recorded in the audit log. Notes are visible to admins only."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={update.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setFailure(null);
          try {
            await update.mutateAsync({ id: enquiry.id, status, note });
            toast({ title: 'Enquiry updated', description: STATUS[status].label });
            onClose();
          } catch (err) {
            setFailure(err instanceof UserFacingError ? err.message : 'The enquiry could not be updated.');
          }
        }}
      >
        {failure && (
          <p
            role="alert"
            className="rounded-[var(--radius-control)] bg-loss-soft px-3 py-2 text-sm text-loss"
          >
            {failure}
          </p>
        )}
        <FormField label="Status">
          {(f) => (
            <Select {...f} value={status} onChange={(e) => setStatus(e.target.value as EnquiryStatus)}>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="closed">Closed</option>
            </Select>
          )}
        </FormField>
        <FormField
          label="Note"
          hint={enquiry.admin_note ? `Current note: ${enquiry.admin_note}` : 'Optional'}
        >
          {(f) => (
            <Textarea
              {...f}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
            />
          )}
        </FormField>
      </form>
    </Dialog>
  );
}

/** Website enquiries (admins only). */
export function EnquiriesPage() {
  const [filter, setFilter] = useState<EnquiryStatus | ''>('');
  const all = useEnquiries('');
  const list = useEnquiries(filter);
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const count = (s: EnquiryStatus) => (all.data ?? []).filter((e) => e.status === s).length;

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Messages sent through the public website's contact form. Reply by email or phone, then update the status."
      />
      <section aria-label="Enquiry counts" className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="New"
          tone="sky"
          loading={all.isPending}
          value={String(count('new'))}
          meta="Awaiting a reply"
        />
        <StatCard label="Contacted" tone="amber" loading={all.isPending} value={String(count('contacted'))} />
        <StatCard label="Closed" tone="emerald" loading={all.isPending} value={String(count('closed'))} />
      </section>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 text-sm">
          <label htmlFor="enquiry-filter" className="text-muted">
            Show
          </label>
          <Select
            id="enquiry-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as EnquiryStatus | '')}
            className="w-44"
          >
            <option value="">All enquiries</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </Select>
        </div>
        {list.isPending ? (
          <TableSkeleton rows={4} columns={4} />
        ) : list.isError ? (
          <ErrorState message="Enquiries could not be loaded." onRetry={() => void list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No enquiries yet"
            description="Enquiries submitted on the public website will appear here."
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.data.map((e) => (
              <li key={e.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{e.full_name}</p>
                      <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge>
                      <Badge tone="neutral">{interestLabel(e.interest)}</Badge>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      <a
                        href={`mailto:${e.email}`}
                        className="inline-flex items-center gap-1 hover:text-ink hover:underline"
                      >
                        <Mail aria-hidden="true" className="size-3.5" />
                        {e.email}
                      </a>
                      {e.phone && (
                        <a
                          href={`tel:${e.phone.replace(/\s/g, '')}`}
                          className="inline-flex items-center gap-1 hover:text-ink hover:underline"
                        >
                          <Phone aria-hidden="true" className="size-3.5" />
                          {e.phone}
                        </a>
                      )}
                      {e.city && <span>{e.city}</span>}
                      <time dateTime={e.created_at}>{formatDateTime(e.created_at)}</time>
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(e)}>
                    Update status
                  </Button>
                </div>
                <p className="mt-3 text-sm break-words whitespace-pre-line">{e.message}</p>
                {e.admin_note && <p className="mt-2 text-xs text-muted">Note: {e.admin_note}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing && <UpdateDialog enquiry={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
