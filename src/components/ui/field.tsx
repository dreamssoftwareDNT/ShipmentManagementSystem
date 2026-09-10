import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-1 text-critical">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-critical">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
