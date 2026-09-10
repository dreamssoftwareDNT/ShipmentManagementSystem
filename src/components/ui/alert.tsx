import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'error';

const TONE_STYLES: Record<AlertTone, { className: string; Icon: typeof Info }> = {
  info: { className: 'bg-info-soft text-info', Icon: Info },
  success: { className: 'bg-positive-soft text-positive', Icon: CheckCircle2 },
  warning: { className: 'bg-warning-soft text-warning', Icon: AlertTriangle },
  error: { className: 'bg-critical-soft text-critical', Icon: XCircle },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { className: toneClass, Icon } = TONE_STYLES[tone];

  return (
    <div className={cn('flex gap-2.5 rounded-md px-3 py-2.5 text-sm', toneClass, className)} role="alert">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5', 'text-xs leading-relaxed')}>{children}</div> : null}
      </div>
    </div>
  );
}
