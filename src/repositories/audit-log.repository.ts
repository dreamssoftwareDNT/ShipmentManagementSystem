import type { AuditLog, Prisma } from '@prisma/client';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';
import type { PageRequest, PageResult } from '@/types/common';

export class AuditLogRepository {
  async record(
    data: Prisma.AuditLogUncheckedCreateInput,
    client?: DatabaseClient,
  ): Promise<AuditLog> {
    return resolveClient(client).auditLog.create({ data });
  }

  async paginate(
    where: Prisma.AuditLogWhereInput,
    page: PageRequest,
    client?: DatabaseClient,
  ): Promise<PageResult<AuditLog>> {
    const db = resolveClient(client);
    const skip = (page.page - 1) * page.pageSize;

    const [total, items] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: page.pageSize,
        include: { user: { select: { id: true, fullName: true, email: true } } },
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / page.pageSize);

    return {
      items,
      page: page.page,
      pageSize: page.pageSize,
      total,
      totalPages,
      hasNext: page.page < totalPages,
      hasPrevious: page.page > 1,
    };
  }

  async listForEntity(
    entityName: string,
    entityId: string,
    take = 50,
    client?: DatabaseClient,
  ): Promise<AuditLog[]> {
    return resolveClient(client).auditLog.findMany({
      where: { entityName, entityId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { user: { select: { id: true, fullName: true } } },
    });
  }
}

export const auditLogRepository = new AuditLogRepository();
