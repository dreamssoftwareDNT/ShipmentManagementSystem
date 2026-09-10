'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { DataTable, type DataTableColumn } from './data-table';
import { Pagination } from './pagination';
import { TableToolbar } from './toolbar';
import type { PagedResourceState } from '@/hooks/use-paged-resource';

export interface ResourceListProps<TRow> {
  resource: PagedResourceState<TRow>;
  columns: Array<DataTableColumn<TRow>>;
  rowKey: (row: TRow) => string;
  searchPlaceholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: TRow) => void;
}

/**
 * The list surface every module shares: search, filters, sortable grid and
 * server side pagination wired to one resource hook.
 */
export function ResourceList<TRow>({
  resource,
  columns,
  rowKey,
  searchPlaceholder,
  filters,
  actions,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRowClick,
}: ResourceListProps<TRow>) {
  return (
    <Card>
      <TableToolbar
        search={resource.search}
        onSearchChange={resource.setSearch}
        searchPlaceholder={searchPlaceholder}
        filters={filters}
        actions={actions}
      />

      {resource.error ? (
        <div className="px-4 pt-4">
          <Alert tone="error">{resource.error}</Alert>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={resource.rows}
        rowKey={rowKey}
        loading={resource.loading}
        sortBy={resource.sortBy}
        sortDirection={resource.sortDirection}
        onSortChange={resource.toggleSort}
        onRowClick={onRowClick}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
      />

      {resource.total > 0 ? (
        <Pagination
          page={resource.page}
          pageSize={resource.pageSize}
          total={resource.total}
          totalPages={resource.totalPages}
          onPageChange={resource.setPage}
          onPageSizeChange={resource.setPageSize}
        />
      ) : null}
    </Card>
  );
}
