import { Link } from 'react-router';
import { cn } from '@/lib/utils/cn';

/** `embedded` renders inside an app shell instead of as a full-screen page. */
export function NotFoundPage({ embedded = false }: { embedded?: boolean }) {
  const Wrapper = embedded ? 'div' : 'main';
  return (
    <Wrapper
      className={cn(
        'mx-auto flex max-w-xl flex-col items-center justify-center px-4 text-center',
        embedded ? 'py-16' : 'min-h-dvh',
      )}
    >
      <p className="num text-sm font-semibold text-muted">404</p>
      <h1 className="mt-2 text-2xl">Page not found</h1>
      <p className="mt-2 text-muted">The page you are looking for does not exist or has moved.</p>
      <Link
        to={embedded ? '..' : '/'}
        relative="path"
        className="mt-6 rounded-[var(--radius-control)] bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
      >
        Go back
      </Link>
    </Wrapper>
  );
}
