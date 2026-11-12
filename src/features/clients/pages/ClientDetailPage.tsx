import { ChevronLeft, HandCoins, Pencil, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/toast-context';
import { formatDate, formatDateTime } from '@/lib/format';
import { ClientHistory } from '../components/ClientHistory';
import { ClientStatusBadge } from '../components/ClientStatusBadge';
import { EditContactDialog } from '../components/EditContactDialog';
import { isUuid, useClient, useSetClientStatus } from '../queries';

function BackLink() {
  return (
    <Link
      to="/admin/clients"
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      All clients
    </Link>
  );
}

export function ClientDetailPage() {
  const { clientId = '' } = useParams();
  const validId = isUuid(clientId);
  const { data: client, isPending, isError, refetch } = useClient(clientId);
  const setStatus = useSetClientStatus(clientId);
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  if (!validId || (!isPending && !isError && !client)) {
    return (
      <>
        <BackLink />
        <Card>
          <EmptyState
            title="Client not found"
            description="This client does not exist or is not a client account."
          />
        </Card>
      </>
    );
  }

  if (isPending) {
    return (
      <LoadingRegion label="Loading client">
        <BackLink />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-40" />
      </LoadingRegion>
    );
  }

  if (isError || !client) {
    return (
      <>
        <BackLink />
        <Card>
          <ErrorState message="This client could not be loaded." onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  const deactivating = client.status === 'active';

  return (
    <>
      <BackLink />
      <PageHeader
        title={client.full_name || client.email}
        badges={<ClientStatusBadge status={client.status} />}
        description={`Client since ${formatDate(client.created_at)}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden="true" className="size-4" />
              Edit details
            </Button>
            <Button variant={deactivating ? 'danger' : 'primary'} onClick={() => setStatusOpen(true)}>
              {deactivating ? (
                <UserX aria-hidden="true" className="size-4" />
              ) : (
                <UserCheck aria-hidden="true" className="size-4" />
              )}
              {deactivating ? 'Deactivate' : 'Reactivate'}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Profile" />
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">Full name</dt>
                  <dd className="mt-0.5 font-medium">{client.full_name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted">Email (sign-in)</dt>
                  <dd className="mt-0.5 font-medium break-all">{client.email}</dd>
                </div>
                <div>
                  <dt className="text-muted">Phone</dt>
                  <dd className="mt-0.5 num font-medium">{client.phone ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted">Last updated</dt>
                  <dd className="mt-0.5 num font-medium">{formatDateTime(client.updated_at)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Investment" description="Contributions, unit allocations and statements." />
            <EmptyState
              icon={HandCoins}
              title="No contributions yet"
              description="Contributions, issued units and statements will appear here once contribution recording is available."
            />
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Account history" description="From the audit log." />
          <ClientHistory clientId={client.id} />
        </Card>
      </div>

      {editOpen && <EditContactDialog client={client} open onOpenChange={setEditOpen} />}

      <ConfirmDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        title={
          deactivating
            ? `Deactivate ${client.full_name || 'client'}?`
            : `Reactivate ${client.full_name || 'client'}?`
        }
        description={
          deactivating
            ? 'They will no longer be able to sign in. Their records are kept and nothing is deleted.'
            : 'They will be able to sign in again and see their own records.'
        }
        confirmLabel={deactivating ? 'Deactivate' : 'Reactivate'}
        tone={deactivating ? 'danger' : 'primary'}
        requireReason
        onConfirm={async (reason) => {
          await setStatus.mutateAsync({ status: deactivating ? 'inactive' : 'active', reason });
          toast({ title: deactivating ? 'Client deactivated' : 'Client reactivated' });
        }}
      />
    </>
  );
}
