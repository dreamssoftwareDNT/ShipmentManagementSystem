'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { ApiError, apiClient } from '@/lib/api/client';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/schemas/auth.schema';

interface ResetResponse {
  message: string;
  developmentToken?: string | null;
}

export function ForgotPasswordForm() {
  const [result, setResult] = useState<ResetResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      setResult(await apiClient.post<ResetResponse>('/auth/forgot-password', values));
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'The request could not be sent.');
    }
  });

  if (result) {
    return (
      <Alert tone="success" title="Request received">
        {result.message}
        {result.developmentToken ? (
          <span className="mt-2 block break-all">
            Development token:{' '}
            <a
              className="font-medium underline"
              href={`/reset-password?token=${result.developmentToken}`}
            >
              {result.developmentToken}
            </a>
          </span>
        ) : null}
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <Field label="Email address" htmlFor="email" error={errors.email?.message} required>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          invalid={Boolean(errors.email)}
          {...register('email')}
        />
      </Field>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        Send reset link
      </Button>
    </form>
  );
}
