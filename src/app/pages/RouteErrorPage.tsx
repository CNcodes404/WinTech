import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

/** Generic route error boundary. Never renders raw error details/stack traces to the user. */
export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText}`
    : 'Something went wrong while loading this page.';

  if (import.meta.env.DEV) console.error(error);

  return (
    <main
      role="alert"
      className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center"
    >
      <h1 className="text-2xl">Unexpected error</h1>
      <p className="mt-2 text-muted">{message}</p>
      <Link to="/" className="mt-6 text-sm font-medium text-emerald-600 hover:underline">
        Return home
      </Link>
    </main>
  );
}
