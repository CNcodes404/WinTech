import { Construction, Lock } from 'lucide-react';
import type { NavItem } from '@/app/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';

type PlaceholderPageProps = { item: NavItem } | { item?: undefined; title: string; description: string };

/** Temporary screen used until each module implements its real page. */
export function PlaceholderPage(props: PlaceholderPageProps) {
  if (!props.item) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
        <PageHeader title={props.title} description={props.description} />
      </main>
    );
  }

  const { item } = props;
  return (
    <>
      <PageHeader title={item.title} description={item.description} />
      <Card>
        {item.disabled ? (
          <EmptyState
            icon={Lock}
            title="Not available in V1"
            description="Settlement and withdrawal processing is deferred until the policy and legal structure are approved."
          />
        ) : (
          <EmptyState
            icon={Construction}
            title="Coming soon"
            description={`This screen will be built in Module ${item.module}.`}
          />
        )}
      </Card>
    </>
  );
}
