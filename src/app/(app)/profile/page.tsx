import type { Metadata } from 'next';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { requireUser } from '@/lib/auth/session';
import { humanise } from '@/utils/format';

export const metadata: Metadata = { title: 'My profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        title="My profile"
        description="Your account and the permissions your roles grant."
        breadcrumbs={[{ label: 'Account' }, { label: 'Profile' }]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Account" />
          <CardBody className="pt-1">
            <dl className="space-y-2">
              <div className="flex justify-between border-b border-border-subtle py-1.5">
                <dt className="text-xs text-ink-subtle">Name</dt>
                <dd className="text-sm">{user.fullName}</dd>
              </div>
              <div className="flex justify-between border-b border-border-subtle py-1.5">
                <dt className="text-xs text-ink-subtle">Email</dt>
                <dd className="text-sm">{user.email}</dd>
              </div>
              <div className="flex items-start justify-between py-1.5">
                <dt className="text-xs text-ink-subtle">Roles</dt>
                <dd className="flex flex-wrap justify-end gap-1">
                  {user.roles.map((role) => (
                    <Badge key={role} tone="brand">
                      {humanise(role)}
                    </Badge>
                  ))}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Effective permissions"
            description={`${user.permissions.length} permissions granted through your roles.`}
          />
          <CardBody className="pt-1">
            <div className="flex flex-wrap gap-1.5">
              {user.permissions.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Your roles grant every permission in the system.
                </p>
              ) : (
                user.permissions
                  .slice()
                  .sort()
                  .map((permission) => (
                    <Badge key={permission} tone="neutral">
                      {permission}
                    </Badge>
                  ))
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
