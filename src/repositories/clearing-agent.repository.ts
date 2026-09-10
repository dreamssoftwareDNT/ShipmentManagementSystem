import type { ClearingAgent, Prisma } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import type { DatabaseClient } from '@/database/unit-of-work';

export class ClearingAgentRepository extends BaseRepository<ClearingAgent> {
  protected readonly entityName = 'Clearing agent';

  protected delegate(client: DatabaseClient): ModelDelegate<ClearingAgent> {
    return client.clearingAgent as unknown as ModelDelegate<ClearingAgent>;
  }

  buildSearchFilter(search?: string): Prisma.ClearingAgentWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { code: { contains: search } },
        { name: { contains: search } },
        { companyName: { contains: search } },
        { licenseNumber: { contains: search } },
        { portOfOperation: { contains: search } },
      ],
    };
  }

  async isCodeTaken(code: string, excludeId?: string, client?: DatabaseClient): Promise<boolean> {
    return this.exists(excludeId ? { code, id: { not: excludeId } } : { code }, client);
  }

  async listActiveOptions(client?: DatabaseClient): Promise<ClearingAgent[]> {
    return this.findAll({ status: 'ACTIVE' }, { orderBy: { name: 'asc' } }, client);
  }
}

export const clearingAgentRepository = new ClearingAgentRepository();
