'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { StatusPill } from '@/components/ui/status-pill';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { ResourceList } from '@/components/data/resource-list';
import type { DataTableColumn } from '@/components/data/data-table';
import { usePagedResource } from '@/hooks/use-paged-resource';
import { useOptions } from '@/hooks/use-options';
import { ApiError, apiClient } from '@/lib/api/client';
import { createUserSchema, type CreateUserInput } from '@/schemas/user.schema';
import { formatDateTime, humanise } from '@/utils/format';
import { UserStatus } from '@/types/enums';

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string | null;
  phone: string | null;
  status: string;
  lastLoginAt: string | null;
  isSystemAccount: boolean;
  roles: Array<{ role: { id: string; code: string; name: string } }>;
}

export interface UserPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

const DEFAULTS = {
  fullName: '',
  email: '',
  employeeCode: '',
  phone: '',
  password: '',
  status: UserStatus.ACTIVE,
  roleIds: [],
};

function UserDialog({
  open,
  user,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: UserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const { options: roles } = useOptions('roles', open);
  const isEdit = Boolean(user);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: DEFAULTS as unknown as CreateUserInput,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormError(null);

    if (user) {
      const assigned = user.roles.map((entry) => entry.role.id);
      setRoleIds(assigned);
      reset({
        fullName: user.fullName,
        email: user.email,
        employeeCode: user.employeeCode ?? '',
        phone: user.phone ?? '',
        password: 'PlaceholderPass1!',
        status: user.status,
        roleIds: assigned,
      } as unknown as CreateUserInput);
      return;
    }

    setRoleIds([]);
    reset(DEFAULTS as unknown as CreateUserInput);
  }, [open, user, reset]);

  const toggleRole = (roleId: string) => {
    setRoleIds((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    if (roleIds.length === 0) {
      setFormError('Assign at least one role.');
      return;
    }

    try {
      if (user) {
        await apiClient.put(`/users/${user.id}`, {
          fullName: values.fullName,
          email: values.email,
          employeeCode: values.employeeCode,
          phone: values.phone,
          status: values.status,
          roleIds,
        });
        toast.success('User updated', values.email);
      } else {
        await apiClient.post('/users', { ...values, roleIds });
        toast.success('User created', values.email);
      }

      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof CreateUserInput, { message: messages[0] });
        }
      }

      setFormError(error instanceof ApiError ? error.message : 'The user could not be saved.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit user' : 'New user'}
      description="Roles decide which modules and actions this person can reach."
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message} required>
            <Input id="fullName" invalid={Boolean(errors.fullName)} {...register('fullName')} />
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email?.message} required>
            <Input id="email" type="email" invalid={Boolean(errors.email)} {...register('email')} />
          </Field>

          <Field label="Employee code" htmlFor="employeeCode" error={errors.employeeCode?.message}>
            <Input id="employeeCode" {...register('employeeCode')} />
          </Field>

          <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" {...register('phone')} />
          </Field>

          {!isEdit ? (
            <Field
              label="Initial password"
              htmlFor="password"
              error={errors.password?.message}
              hint="At least 10 characters with upper, lower, digit and symbol"
              required
            >
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                invalid={Boolean(errors.password)}
                {...register('password')}
              />
            </Field>
          ) : null}

          <Field label="Status" htmlFor="status" error={errors.status?.message}>
            <Select id="status" {...register('status')}>
              {Object.values(UserStatus).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset>
          <legend className="field-label">Roles</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {roles.map((role) => (
              <label
                key={role.value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={roleIds.includes(role.value)}
                  onChange={() => toggleRole(role.value)}
                />
                <span>
                  <span className="block font-medium text-ink">{role.label}</span>
                  <span className="block text-xs text-ink-subtle">{role.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

function PasswordResetDialog({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: UserRow | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!user) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await apiClient.post(`/users/${user.id}/password`, { newPassword: password });
      toast.success('Password reset', `${user.email} must sign in again.`);
      setPassword('');
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The password could not be reset.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reset password"
      description={user ? `All active sessions for ${user.email} will be ended.` : ''}
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={password.length < 10}>
            Reset password
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="New password" htmlFor="newPassword" required>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

export function UserModule({ permissions }: { permissions: UserPermissions }) {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [roleId, setRoleId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);

  const { options: roles } = useOptions('roles');
  const filters = useMemo(
    () => ({ status: status || undefined, roleId: roleId || undefined }),
    [status, roleId],
  );

  const resource = usePagedResource<UserRow>('/users', {
    filters,
    initialSortBy: 'fullName',
    initialSortDirection: 'asc',
  });

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setBusy(true);

    try {
      await apiClient.delete(`/users/${pendingDelete.id}`);
      toast.success('User removed', pendingDelete.email);
      setPendingDelete(null);
      resource.refresh();
    } catch (error) {
      toast.error('Could not remove user', error instanceof ApiError ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const columns: Array<DataTableColumn<UserRow>> = [
    {
      key: 'fullName',
      header: 'User',
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.fullName}</p>
          <p className="truncate text-xs text-ink-muted">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'employeeCode',
      header: 'Employee',
      width: '120px',
      cell: (row) => row.employeeCode ?? '--',
    },
    {
      key: 'roles',
      header: 'Roles',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.map((entry) => (
            <Badge key={entry.role.id} tone="brand">
              {entry.role.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last sign in',
      sortable: true,
      align: 'right',
      width: '160px',
      cell: (row) => formatDateTime(row.lastLoginAt),
    },
    { key: 'status', header: 'Status', width: '110px', cell: (row) => <StatusPill status={row.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '124px',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {permissions.canUpdate ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Edit ${row.fullName}`}
                onClick={() => {
                  setEditing(row);
                  setFormOpen(true);
                }}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Reset password for ${row.fullName}`}
                onClick={() => setResetting(row)}
              >
                <KeyRound className="size-4" aria-hidden />
              </Button>
            </>
          ) : null}
          {permissions.canDelete && !row.isSystemAccount ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${row.fullName}`}
              onClick={() => setPendingDelete(row)}
            >
              <Trash2 className="size-4 text-critical" aria-hidden />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <ResourceList
        resource={resource}
        columns={columns}
        rowKey={(row) => row.id}
        searchPlaceholder="Search by name, email or employee code"
        emptyTitle="No users found"
        filters={
          <>
            <Select
              aria-label="Filter by role"
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              className="w-44"
            >
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-36"
            >
              <option value="">All statuses</option>
              {Object.values(UserStatus).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </>
        }
        actions={
          permissions.canCreate ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              New user
            </Button>
          ) : null
        }
      />

      <UserDialog
        open={formOpen}
        user={editing}
        onClose={() => setFormOpen(false)}
        onSaved={resource.refresh}
      />

      <PasswordResetDialog
        open={Boolean(resetting)}
        user={resetting}
        onClose={() => setResetting(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={busy}
        destructive
        title="Remove this user?"
        confirmLabel="Remove"
        message={`${pendingDelete?.email ?? ''} will lose access immediately and all their sessions end.`}
      />
    </>
  );
}
