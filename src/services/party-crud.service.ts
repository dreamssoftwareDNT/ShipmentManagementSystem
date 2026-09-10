import { BaseService } from './base.service';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import type { BaseRepository } from '@/repositories/base.repository';
import { documentNumberGenerator, type SequenceKey } from '@/database/number-sequence';
import { UnitOfWork, type TransactionClient } from '@/database/unit-of-work';
import { AuditAction } from '@/types/enums';
import type { PageRequest, PageResult, RequestContext, SelectOption } from '@/types/common';

export interface PartyRecord {
  id: string;
  code: string;
  name: string;
}

export interface SearchableRepository<TModel extends PartyRecord> extends BaseRepository<TModel> {
  buildSearchFilter(search?: string): Record<string, unknown>;
  isCodeTaken(code: string, excludeId?: string, client?: TransactionClient): Promise<boolean>;
}

export interface PartyListQuery extends Partial<PageRequest> {
  status?: string;
  country?: string;
}

/**
 * Customers, vendors, clearing agents and money changers share the same
 * lifecycle: coded master record, uniqueness guard, soft delete behind a
 * business rule check, and an audit trail. Subclasses supply the repository,
 * the numbering key and any additional delete restrictions.
 */
export abstract class PartyCrudService<
  TModel extends PartyRecord,
  TCreate extends { code?: string },
  TUpdate extends { code?: string },
> extends BaseService {
  protected abstract readonly entityName: string;
  protected abstract readonly repository: SearchableRepository<TModel>;
  protected abstract readonly sequenceKey: SequenceKey;

  protected additionalFilters(_query: PartyListQuery): Record<string, unknown> {
    return {};
  }

  protected async assertDeletable(_record: TModel, _tx: TransactionClient): Promise<void> {
    return Promise.resolve();
  }

  async list(query: PartyListQuery): Promise<PageResult<TModel>> {
    const page = this.normalizePage(query);

    const where = {
      ...this.repository.buildSearchFilter(page.search),
      ...(query.status ? { status: query.status } : {}),
      ...(query.country ? { country: { contains: query.country } } : {}),
      ...this.additionalFilters(query),
    };

    return this.repository.paginate(where, page, {
      orderBy: page.sortBy ? { [page.sortBy]: page.sortDirection } : { name: 'asc' },
    });
  }

  async getById(id: string): Promise<TModel> {
    return this.repository.requireById(id);
  }

  async options(): Promise<SelectOption[]> {
    const records = await this.repository.findAll(
      { status: 'ACTIVE' },
      { orderBy: { name: 'asc' } },
    );

    return records.map((record) => ({
      value: record.id,
      label: record.name,
      hint: record.code,
    }));
  }

  async create(input: TCreate, context: RequestContext): Promise<TModel> {
    return UnitOfWork.run(async (tx) => {
      const code = input.code || (await documentNumberGenerator.next(this.sequenceKey, tx));

      this.assertUnique(
        await this.repository.isCodeTaken(code, undefined, tx),
        'code',
        `Code ${code} is already in use`,
      );

      const record = await this.repository.create(
        { ...input, code },
        { userId: context.user.id },
        tx,
      );

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: record.id,
          action: AuditAction.CREATE,
          summary: `Created ${this.entityName.toLowerCase()} ${record.code} - ${record.name}`,
        },
        tx,
      );

      return record;
    });
  }

  async update(id: string, input: TUpdate, context: RequestContext): Promise<TModel> {
    return UnitOfWork.run(async (tx) => {
      const existing = await this.repository.requireById(id, {}, tx);

      if (input.code && input.code !== existing.code) {
        this.assertUnique(
          await this.repository.isCodeTaken(input.code, id, tx),
          'code',
          `Code ${input.code} is already in use`,
        );
      }

      const updated = await this.repository.update(
        id,
        { ...input },
        { userId: context.user.id },
        tx,
      );

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Updated ${this.entityName.toLowerCase()} ${updated.code}`,
          changes: this.diff(
            existing as unknown as Record<string, unknown>,
            input as unknown as Record<string, unknown>,
          ),
        },
        tx,
      );

      return updated;
    });
  }

  async remove(id: string, context: RequestContext): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      const record = await this.repository.requireById(id, {}, tx);

      await this.assertDeletable(record, tx);
      await this.repository.softDelete(id, { userId: context.user.id }, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Archived ${this.entityName.toLowerCase()} ${record.code}`,
        },
        tx,
      );
    });
  }

  async history(id: string) {
    return auditLogRepository.listForEntity(this.entityName, id);
  }
}
