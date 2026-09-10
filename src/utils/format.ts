const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return '--';
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? '--' : DATE_FORMATTER.format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) {
    return '--';
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? '--' : DATE_TIME_FORMATTER.format(date);
}

export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function formatCurrency(
  value: string | number | null | undefined,
  currencyCode = 'USD',
): string {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);

  if (!Number.isFinite(amount)) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAmount(value: string | number | null | undefined, digits = 2): string {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);

  if (!Number.isFinite(amount)) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

export function humanise(value: string | null | undefined): string {
  if (!value) {
    return '--';
  }

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function daysBetween(from: Date | string, to: Date | string = new Date()): number {
  const start = from instanceof Date ? from : new Date(from);
  const end = to instanceof Date ? to : new Date(to);

  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}
