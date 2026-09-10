'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { ApiError, apiClient } from '@/lib/api/client';
import { loginSchema, type LoginInput } from '@/schemas/auth.schema';
import type { AuthenticatedUser } from '@/types/common';

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await apiClient.post<{ user: AuthenticatedUser }>('/auth/login', values);
      router.replace(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard');
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Sign in failed. Please try again.',
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <Field label="Email address" htmlFor="email" error={errors.email?.message} required>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="you@company.com"
          invalid={Boolean(errors.email)}
          {...register('email')}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password?.message} required>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          invalid={Boolean(errors.password)}
          {...register('password')}
        />
      </Field>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}
