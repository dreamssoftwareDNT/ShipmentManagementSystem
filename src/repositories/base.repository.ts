import { NotFoundError } from '@/lib/errors';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';
import type { PageRequest, PageResult } from '@/types/common';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ModelDelegate<TModel> {
  findFirst(args?: any): Promise<TModel | null>;
  findMany(args?: any): Promise<TModel[]>;
  create(args: any): Promise<TModel>;
  update(args: any): Promise<TModel>;
  updateMany(args: any): Promise<{ count: number }>;
  count(args?: any): Promise<number>;
  aggregate(args: any): Promise<any>;
  groupBy(args: any): Promise<any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface AuditStamp {
  userId: string;
}

export interface QueryOptions {
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
  orderBy?: Record<string, unknown> | Array<Record<string, unknown>>;
  withDeleted?: boolean;
}

/**
 * Shared persistence behaviour for every soft deletable, audited aggregate.
 * Concrete repositories bind a Prisma delegate and add domain specific queries.
 */
export abstract class BaseRepository<TModel extends { id: string }> {
  protected abstract readonly entityName: string;

  protected abstract delegate(client: DatabaseClient): ModelDelegate<TModel>;

  protected activeScope(withDeleted = false): Record<string, unknown> {
    return withDeleted ? {} : { deletedAt: null };
  }

  protected mergeWhere(
    where: Record<string, unknown> | undefined,
    withDeleted = false,
  ): Record<string, unknown> {
    return { ...(where ?? {}), ...this.activeScope(withDeleted) };
  }

  async findById(
    id: string,
    options: QueryOptions = {},
    client?: DatabaseClient,
  ): Promise<TModel | null> {
    return this.delegate(resolveClient(client)).findFirst({
      where: this.mergeWhere({ id }, options.withDeleted),
      include: options.include,
    });
  }

  async requireById(
    id: string,
    options: QueryOptions = {},
    client?: DatabaseClient,
  ): Promise<TModel> {
    const record = await this.findById(id, options, client);

    if (!record) {
      throw new NotFoundError(this.entityName, id);
    }

    return record;
  }

  async findOne(
    where: Record<string, unknown>,
    options: QueryOptions = {},
    client?: DatabaseClient,
  ): Promise<TModel | null> {
    return this.delegate(resolveClient(client)).findFirst({
      where: this.mergeWhere(where, options.withDeleted),
      include: options.include,
      orderBy: options.orderBy,
    });
  }

  async findAll(
    where: Record<string, unknown> = {},
    options: QueryOptions = {},
    client?: DatabaseClient,
  ): Promise<TModel[]> {
    return this.delegate(resolveClient(client)).findMany({
      where: this.mergeWhere(where, options.withDeleted),
      include: options.include,
      orderBy: options.orderBy,
    });
  }

  async paginate(
    where: Record<string, unknown>,
    page: PageRequest,
    options: QueryOptions = {},
    client?: DatabaseClient,
  ): Promise<PageResult<TModel>> {
    const delegate = this.delegate(resolveClient(client));
    const scopedWhere = this.mergeWhere(where, options.withDeleted);
    const skip = (page.page - 1) * page.pageSize;

    const [total, items] = await Promise.all([
      delegate.count({ where: scopedWhere }),
      delegate.findMany({
        where: scopedWhere,
        include: options.include,
        orderBy: options.orderBy ?? this.defaultOrderBy(page),
        skip,
        take: page.pageSize,
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

  protected defaultOrderBy(page: PageRequest): Record<string, unknown> {
    return page.sortBy
      ? { [page.sortBy]: page.sortDirection }
      : { createdAt: 'desc' };
  }

  async exists(where: Record<string, unknown>, client?: DatabaseClient): Promise<boolean> {
    const count = await this.delegate(resolveClient(client)).count({
      where: this.mergeWhere(where),
    });
    return count > 0;
  }

  async count(where: Record<string, unknown> = {}, client?: DatabaseClient): Promise<number> {
    return this.delegate(resolveClient(client)).count({ where: this.mergeWhere(where) });
  }

  async create(
    data: Record<string, unknown>,
    audit: AuditStamp,
    client?: DatabaseClient,
  ): Promise<TModel> {
    return this.delegate(resolveClient(client)).create({
      data: { ...data, createdById: audit.userId, updatedById: audit.userId },
    });
  }

  async update(
    id: string,
    data: Record<string, unknown>,
    audit: AuditStamp,
    client?: DatabaseClient,
  ): Promise<TModel> {
    return this.delegate(resolveClient(client)).update({
      where: { id },
      data: { ...data, updatedById: audit.userId },
    });
  }

  async softDelete(id: string, audit: AuditStamp, client?: DatabaseClient): Promise<void> {
    await this.delegate(resolveClient(client)).update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: audit.userId, updatedById: audit.userId },
    });
  }

  async restore(id: string, audit: AuditStamp, client?: DatabaseClient): Promise<void> {
    await this.delegate(resolveClient(client)).update({
      where: { id },
      data: { deletedAt: null, deletedById: null, updatedById: audit.userId },
    });
  }
}
