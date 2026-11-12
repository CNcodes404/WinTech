import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField, Select } from '@/components/ui/Form';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/toast-context';
import { setUserRole } from '@/features/admin-accounts/api';
import { useAuth } from '@/features/auth/auth-context';
import { NewPasswordForm } from '@/features/auth/components/NewPasswordForm';
import { usePeople, type PersonOption } from '@/features/reports/api';

function useSetRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role, reason }: { id: string; role: 'admin' | 'client'; reason: string }) =>
      setUserRole(id, role, reason),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['clients'] }),
        qc.invalidateQueries({ queryKey: ['audit'] }),
      ]),
  });
}

export function SettingsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const people = usePeople();
  const setRole = useSetRole();
  const [grantOpen, setGrantOpen] = useState(false);
  const [candidate, setCandidate] = useState('');
  const [toRemove, setToRemove] = useState<PersonOption | null>(null);

  const admins = (people.data ?? []).filter((p) => p.role === 'admin');
  const candidates = (people.data ?? []).filter((p) => p.role === 'client' && p.status === 'active');
  const chosen = candidates.find((c) => c.id === candidate);

  return (
    <>
      <PageHeader title="Settings" description="Administrator access and your own sign-in security." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Administrators"
            description="Admins can see and change all records. Every change needs a reason and is recorded in the audit log."
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setGrantOpen(true)}
                disabled={candidates.length === 0}
              >
                <UserPlus aria-hidden="true" className="size-4" />
                Grant admin access
              </Button>
            }
          />
          {people.isPending ? (
            <TableSkeleton rows={2} columns={3} />
          ) : people.isError ? (
            <ErrorState message="Administrators could not be loaded." onRetry={() => void people.refetch()} />
          ) : (
            <ul className="divide-y divide-line">
              {admins.map((a) => {
                const self = a.id === profile?.id;
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <ShieldCheck aria-hidden="true" className="size-5 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {a.full_name || a.email} {self && <span className="text-muted">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-muted">{a.email}</p>
                    </div>
                    {a.status === 'inactive' && <Badge tone="neutral">Inactive</Badge>}
                    {!self && (
                      <Button variant="ghost" size="sm" onClick={() => setToRemove(a)}>
                        <ShieldOff aria-hidden="true" className="size-4" />
                        Remove admin access
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            You cannot change your own role, and the last active administrator cannot be removed. New
            administrators are promoted from existing client accounts (create one in Clients first).
          </p>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Change your password" as="h2" />
          <CardContent>
            <NewPasswordForm
              submitLabel="Update password"
              onDone={() => toast({ title: 'Password updated' })}
            />
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={grantOpen}
        onOpenChange={(o) => {
          setGrantOpen(o);
          if (!o) setCandidate('');
        }}
        title="Grant administrator access?"
        description="The person will be able to see and change all records, including other clients' data."
        confirmLabel="Grant admin access"
        tone="danger"
        requireReason
        confirmDisabled={!chosen}
        onConfirm={async (reason) => {
          if (!chosen) return;
          await setRole.mutateAsync({ id: chosen.id, role: 'admin', reason });
          toast({ title: 'Admin access granted', description: chosen.full_name || chosen.email });
          setCandidate('');
        }}
      >
        <FormField label="Person" hint="Active client accounts only.">
          {(field) => (
            <Select {...field} value={candidate} onChange={(e) => setCandidate(e.target.value)}>
              <option value="">Choose a person</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name || c.email} — {c.email}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </ConfirmDialog>

      {toRemove && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setToRemove(null)}
          title={`Remove admin access from ${toRemove.full_name || toRemove.email}?`}
          description="Their account becomes a client account. They keep their sign-in but lose access to the admin console."
          confirmLabel="Remove admin access"
          tone="danger"
          requireReason
          onConfirm={async (reason) => {
            await setRole.mutateAsync({ id: toRemove.id, role: 'client', reason });
            toast({ title: 'Admin access removed' });
          }}
        />
      )}
    </>
  );
}
