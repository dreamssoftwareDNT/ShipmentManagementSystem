'use client';

import { useMemo, useState } from 'react';
import { Check, Minus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import { humanise } from '@/utils/format';

export interface RoleSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCodes: string[];
}

export interface PermissionEntry {
  code: string;
  module: string;
  action: string;
}

/**
 * Read only view of who can do what. Roles are seeded from the permission
 * matrix in configuration, so this screen exists to make the policy visible
 * rather than to invent it.
 */
export function RoleMatrix({
  roles,
  permissions,
}: {
  roles: RoleSummary[];
  permissions: PermissionEntry[];
}) {
  const [activeRoleId, setActiveRoleId] = useState(roles[0]?.id ?? '');

  const modules = useMemo(() => {
    const grouped = new Map<string, string[]>();

    for (const permission of permissions) {
      grouped.set(permission.module, [...(grouped.get(permission.module) ?? []), permission.action]);
    }

    return [...grouped.entries()].map(([module, actions]) => ({ module, actions }));
  }, [permissions]);

  const activeRole = roles.find((role) => role.id === activeRoleId) ?? roles[0];
  const granted = useMemo(
    () => new Set(activeRole?.permissionCodes ?? []),
    [activeRole],
  );

  const isAdministrator = activeRole?.code === 'ADMIN';

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <nav className="space-y-1.5" aria-label="Roles">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => setActiveRoleId(role.id)}
            className={cn(
              'w-full rounded-md border px-3 py-2.5 text-left transition-colors',
              activeRoleId === role.id
                ? 'border-brand bg-brand-soft'
                : 'border-border-subtle bg-surface hover:bg-surface-muted',
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'text-sm font-medium',
                  activeRoleId === role.id ? 'text-brand-strong' : 'text-ink',
                )}
              >
                {role.name}
              </span>
              <Badge tone={role.userCount > 0 ? 'neutral' : 'warning'}>
                {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
              </Badge>
            </span>
            {role.description ? (
              <span className="mt-0.5 block text-xs text-ink-muted">{role.description}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <Card>
        <CardHeader
          title={`${activeRole?.name ?? 'Role'} permissions`}
          description={
            isAdministrator
              ? 'The administrator role always holds every permission in the system.'
              : 'A tick means the role may perform that action in that module.'
          }
        />

        <div className="data-grid-scroll">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-muted text-xs tracking-wide text-ink-subtle uppercase">
                <th className="px-3 py-2 text-left">Module</th>
                <th className="px-3 py-2 text-center">Create</th>
                <th className="px-3 py-2 text-center">Read</th>
                <th className="px-3 py-2 text-center">Update</th>
                <th className="px-3 py-2 text-center">Delete</th>
                <th className="px-3 py-2 text-center">Approve</th>
                <th className="px-3 py-2 text-center">Export</th>
              </tr>
            </thead>
            <tbody>
              {modules.map(({ module, actions }) => (
                <tr key={module} className="border-b border-border-subtle last:border-b-0">
                  <td className="px-3 py-2 text-sm font-medium text-ink">{humanise(module)}</td>
                  {['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'EXPORT'].map((action) => {
                    const applicable = actions.includes(action);
                    const allowed = isAdministrator
                      ? applicable
                      : granted.has(`${module}:${action}`);

                    return (
                      <td key={action} className="px-3 py-2 text-center">
                        {!applicable ? (
                          <span className="text-border-strong">·</span>
                        ) : allowed ? (
                          <Check className="mx-auto size-4 text-positive" aria-label="Allowed" />
                        ) : (
                          <Minus className="mx-auto size-4 text-border-strong" aria-label="Not allowed" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
