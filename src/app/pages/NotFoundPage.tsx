import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="num text-muted text-sm font-semibold">404</p>
      <h1 className="mt-2 text-2xl">Page not found</h1>
      <p className="text-muted mt-2">The page you are looking for does not exist or has moved.</p>
      <Link
        to="/"
        className="bg-navy-900 hover:bg-navy-800 mt-6 rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium text-white"
      >
        Go to home
      </Link>
    </main>
  );
}
