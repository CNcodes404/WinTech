import { Outlet } from 'react-router';
import { BrandMark } from '@/components/layout/BrandMark';
import { DemoNotice } from '@/components/layout/DemoNotice';

/** Centered card layout for sign-in, forgot-password and reset-password screens. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <BrandMark />
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
            <Outlet />
          </div>
        </div>
      </main>
      <footer className="mx-auto w-full max-w-md px-4 pb-6">
        <DemoNotice />
      </footer>
    </div>
  );
}

export function AuthHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-[var(--radius-control)] border border-loss/20 bg-loss-soft px-3 py-2 text-sm text-loss"
    >
      {message}
    </p>
  );
}
