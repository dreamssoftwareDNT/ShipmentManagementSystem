import { ValidationError } from '@/lib/errors';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import type { DatabaseClient } from '@/database/unit-of-work';
import type { AuditAction } from '@/types/enums';
import type { PageRequest, RequestContext } from '@/types/common';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

export interface AuditEvent {
  entityName: string;
  entityId: string;
  action: AuditAction;
  summary?: string;
  changes?: Record<string, unknown>;
}

export abstract class BaseService {
  protected normalizePage(input: Partial<PageRequest> | undefined): PageRequest {
    const page = Math.max(1, Math.trunc(input?.page ?? 1));
    const requestedSize = Math.trunc(input?.pageSize ?? DEFAULT_PAGE_SIZE);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedSize));

    return {
      page,
      pageSize,
      sortBy: input?.sortBy,
      sortDirection: input?.sortDirection === 'asc' ? 'asc' : 'desc',
      search: input?.search?.trim() || undefined,
    };
  }

  protected assertUnique(taken: boolean, field: string, message: string): void {
    if (taken) {
      throw new ValidationError(message, { [field]: [message] });
    }
  }

  protected async writeAudit(
    context: RequestContext,
    event: AuditEvent,
    client?: DatabaseClient,
  ): Promise<void> {
    await auditLogRepository.record(
      {
        entityName: event.entityName,
        entityId: event.entityId,
        action: event.action,
        summary: event.summary ?? null,
        changes: event.changes ? JSON.stringify(event.changes) : null,
        userId: context.user.id,
        ipAddress: context.ipAddress ?? null,
      },
      client,
    );
  }

  protected diff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    for (const [key, nextValue] of Object.entries(after)) {
      const previousValue = before[key];
      const normalizedPrevious = previousValue instanceof Date ? previousValue.toISOString() : previousValue;
      const normalizedNext = nextValue instanceof Date ? nextValue.toISOString() : nextValue;

      if (String(normalizedPrevious ?? '') !== String(normalizedNext ?? '')) {
        changes[key] = { from: normalizedPrevious ?? null, to: normalizedNext ?? null };
      }
    }

    return changes;
  }
}
