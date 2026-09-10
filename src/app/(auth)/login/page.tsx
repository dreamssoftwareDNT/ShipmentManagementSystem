import type { Metadata } from 'next';
import Link from 'next/link';
import { Ship } from 'lucide-react';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between bg-brand-strong px-10 py-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-white/15">
            <Ship className="size-5" aria-hidden />
          </span>
          <span className="text-base font-semibold tracking-tight">ImportMS</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl leading-tight font-semibold text-white">
            Every shipment, cost and settlement in one register.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/75">
            Track bookings from draft to closed, capture carrier and clearing costs against the job,
            bill the customer, and reconcile each party statement without leaving the system.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/15 pt-6">
            <div>
              <dt className="text-xs tracking-wide text-white/60 uppercase">Lifecycle</dt>
              <dd className="mt-1 text-sm font-medium">8 stages</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-white/60 uppercase">Ledgers</dt>
              <dd className="mt-1 text-sm font-medium">Append only</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-white/60 uppercase">Access</dt>
              <dd className="mt-1 text-sm font-medium">Role based</dd>
            </div>
          </dl>
        </div>

        <p className="text-xs text-white/50">
          Authorised use only. All activity is recorded in the audit log.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-md bg-brand text-white">
              <Ship className="size-5" aria-hidden />
            </span>
          </div>

          <h2 className="text-xl">Sign in</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Use the credentials issued by your administrator.
          </p>

          <div className="mt-6">
            <LoginForm redirectTo={next} />
          </div>

          <p className="mt-6 text-xs text-ink-subtle">
            Trouble signing in?{' '}
            <Link href="/forgot-password" className="font-medium text-brand hover:underline">
              Reset your password
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
