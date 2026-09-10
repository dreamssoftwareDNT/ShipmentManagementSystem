import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="panel max-w-md px-6 py-8 text-center">
        <p className="text-xs font-semibold tracking-widest text-ink-subtle uppercase">Error 404</p>
        <h1 className="mt-2 text-xl">This page does not exist</h1>
        <p className="mt-2 text-sm text-ink-muted">
          The record may have been archived, or the link is out of date.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
