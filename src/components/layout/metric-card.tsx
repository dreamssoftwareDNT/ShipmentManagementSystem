import { cn } from '@/utils/cn';

export type MetricIntent = 'neutral' | 'positive' | 'negative' | 'warning';

const INTENT_ACCENT: Record<MetricIntent, string> = {
  neutral: 'bg-border-strong',
  positive: 'bg-positive',
  negative: 'bg-critical',
  warning: 'bg-warning',
};

export function MetricCard({
  label,
  value,
  changeLabel,
  intent = 'neutral',
  prefix,
}: {
  label: string;
  value: string;
  changeLabel?: string;
  intent?: MetricIntent;
  prefix?: string;
}) {
  return (
    <article className="panel relative overflow-hidden px-4 py-3.5">
      <span className={cn('absolute inset-y-0 left-0 w-0.5', INTENT_ACCENT[intent])} aria-hidden />
      <p className="text-xs font-medium tracking-wide text-ink-subtle uppercase">{label}</p>
      <p className="numeric mt-1.5 text-2xl leading-none font-semibold text-ink">
        {prefix ? <span className="mr-0.5 text-base text-ink-muted">{prefix}</span> : null}
        {value}
      </p>
      {changeLabel ? <p className="mt-1.5 text-xs text-ink-muted">{changeLabel}</p> : null}
    </article>
  );
}
