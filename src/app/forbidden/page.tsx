import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="panel max-w-md px-6 py-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-critical-soft text-critical">
          <ShieldAlert className="size-5" aria-hidden />
        </span>
        <h1 className="mt-3 text-xl">You do not have access to this area</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your role does not include permission for this module. Ask an administrator if you need it.
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
