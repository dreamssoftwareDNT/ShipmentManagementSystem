import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-xl">Choose a new password</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Passwords need at least ten characters with upper and lower case, a digit and a symbol.
        </p>

        <div className="mt-6">
          <ResetPasswordForm token={token ?? ''} />
        </div>

        <p className="mt-6 text-xs text-ink-subtle">
          <Link href="/login" className="font-medium text-brand hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
