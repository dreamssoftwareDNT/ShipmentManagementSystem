'use client';

import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingPanel } from '@/components/ui/spinner';

export interface DataTableColumn<TRow> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  sortable?: boolean;
  cell: (row: TRow) => ReactNode;
}

export interface DataTableProps<TRow> {
  columns: Array<DataTableColumn<TRow>>;
  rows: TRow[];
  rowKey: (row: TRow) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (key: string) => void;
  onRowClick?: (row: TRow) => void;
}

const ALIGN_CLASSES = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const;

export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  emptyAction,
  sortBy,
  sortDirection = 'desc',
  onSortChange,
  onRowClick,
}: DataTableProps<TRow>) {
  if (loading) {
    return <LoadingPanel />;
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className="data-grid-scroll">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-border-subtle bg-surface-muted">
            {columns.map((column) => {
              const isSorted = sortBy === column.key;
              const align = ALIGN_CLASSES[column.align ?? 'left'];

              return (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    'px-3 py-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase whitespace-nowrap',
                    align,
                  )}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.key)}
                      className={cn(
                        'inline-flex items-center gap-1 transition-colors hover:text-ink',
                        isSorted && 'text-ink',
                        column.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {column.header}
                      {isSorted ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="size-3" aria-hidden />
                        ) : (
                          <ArrowDown className="size-3" aria-hidden />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-50" aria-hidden />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-border-subtle last:border-b-0',
                onRowClick && 'cursor-pointer transition-colors hover:bg-surface-muted',
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-3 py-2.5 text-sm text-ink align-middle',
                    ALIGN_CLASSES[column.align ?? 'left'],
                    column.align === 'right' && 'numeric',
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
