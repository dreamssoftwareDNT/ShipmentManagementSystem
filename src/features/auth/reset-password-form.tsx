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
import { resetPasswordSchema, type ResetPasswordInput } from '@/schemas/auth.schema';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await apiClient.post('/auth/reset-password', values);
      setDone(true);
      window.setTimeout(() => router.replace('/login'), 1500);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof ResetPasswordInput, { message: messages[0] });
        }
        return;
      }

      setFormError(
        error instanceof ApiError ? error.message : 'The password could not be updated.',
      );
    }
  });

  if (done) {
    return (
      <Alert tone="success" title="Password updated">
        Taking you to the sign in page.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <input type="hidden" {...register('token')} />

      <Field label="New password" htmlFor="newPassword" error={errors.newPassword?.message} required>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.newPassword)}
          {...register('newPassword')}
        />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        error={errors.confirmPassword?.message}
        required
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.confirmPassword)}
          {...register('confirmPassword')}
        />
      </Field>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        Update password
      </Button>
    </form>
  );
}
