import { Link } from 'react-router';

interface PlaceholderPageProps {
  title: string;
  area: 'Admin' | 'Client' | 'Auth';
}

/** Temporary page used until each module implements its real screen. */
export function PlaceholderPage({ title, area }: PlaceholderPageProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-12">
      <p className="text-muted text-sm font-medium">{area}</p>
      <h1 className="mt-1 text-2xl">{title}</h1>
      <p className="text-muted mt-3">
        This screen is a placeholder. It will be implemented in a later module.
      </p>
      <Link to="/" className="mt-6 text-sm font-medium text-emerald-600 hover:underline">
        ← Back to foundation preview
      </Link>
    </main>
  );
}
