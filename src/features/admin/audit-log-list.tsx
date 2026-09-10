'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/input';
import { ResourceList } from '@/components/data/resource-list';
import type { DataTableColumn } from '@/components/data/data-table';
import { usePagedResource } from '@/hooks/use-paged-resource';
import { formatDateTime, humanise } from '@/utils/format';
import { AuditAction } from '@/types/enums';

export interface AuditLogRow {
  id: string;
  entityName: string;
  entityId: string;
  action: string;
  summary: string | null;
  changes: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; fullName: string; email: string } | null;
}

const ACTION_TONES: Record<string, 'neutral' | 'positive' | 'warning' | 'critical' | 'brand' | 'info'> = {
  CREATE: 'positive',
  UPDATE: 'info',
  DELETE: 'critical',
  CANCEL: 'critical',
  APPROVE: 'positive',
  POST: 'brand',
  STATUS_CHANGE: 'info',
  LOGIN: 'neutral',
  LOGOUT: 'neutral',
  PASSWORD_RESET: 'warning',
  UPLOAD: 'neutral',
  RESTORE: 'warning',
};

export function AuditLogList({ entityNames }: { entityNames: string[] }) {
  const [action, setAction] = useState('');
  const [entityName, setEntityName] = useState('');

  const filters = useMemo(
    () => ({ action: action || undefined, entityName: entityName || undefined }),
    [action, entityName],
  );

  const resource = usePagedResource<AuditLogRow>('/audit-logs', { filters });

  const columns: Array<DataTableColumn<AuditLogRow>> = [
    {
      key: 'createdAt',
      header: 'When',
      align: 'right',
      width: '170px',
      cell: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'user',
      header: 'Who',
      width: '190px',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{row.user?.fullName ?? 'System'}</p>
          {row.ipAddress ? <p className="truncate text-xs text-ink-subtle">{row.ipAddress}</p> : null}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: '140px',
      cell: (row) => <Badge tone={ACTION_TONES[row.action] ?? 'neutral'}>{humanise(row.action)}</Badge>,
    },
    { key: 'entityName', header: 'Record', width: '150px', cell: (row) => row.entityName },
    {
      key: 'summary',
      header: 'Detail',
      cell: (row) => <span className="text-ink-muted">{row.summary ?? row.entityId}</span>,
    },
  ];

  return (
    <ResourceList
      resource={resource}
      columns={columns}
      rowKey={(row) => row.id}
      searchPlaceholder="Search the audit trail"
      emptyTitle="No activity recorded"
      filters={
        <>
          <Select
            aria-label="Filter by record type"
            value={entityName}
            onChange={(event) => setEntityName(event.target.value)}
            className="w-44"
          >
            <option value="">All records</option>
            {entityNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="w-40"
          >
            <option value="">All actions</option>
            {Object.values(AuditAction).map((value) => (
              <option key={value} value={value}>
                {humanise(value)}
              </option>
            ))}
          </Select>
        </>
      }
    />
  );
}
