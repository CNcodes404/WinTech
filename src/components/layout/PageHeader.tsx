import type { ReactNode } from 'react';
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** The page's single primary action (plus optional secondary actions). */
  actions?: ReactNode;
  /** Badges next to the title (e.g. <DemoBadge />). */
  badges?: ReactNode;
}

export function PageHeader({ title, description, actions, badges }: PageHeaderProps) {
  useDocumentTitle(title);
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl">{title}</h1>
          {badges}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
