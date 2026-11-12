import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Noun for the summary, e.g. "clients". */
  itemLabel?: string;
}

export function Pagination({ page, pageSize, total, onPageChange, itemLabel = 'results' }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
    >
      <p className="num text-muted" aria-live="polite">
        {total === 0 ? `No ${itemLabel}` : `Showing ${from}–${to} of ${total} ${itemLabel}`}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </Button>
          <span className="num text-muted">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}
    </nav>
  );
}
