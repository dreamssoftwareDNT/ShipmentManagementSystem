import type { Prisma, Warehouse } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import type { DatabaseClient } from '@/database/unit-of-work';

export class WarehouseRepository extends BaseRepository<Warehouse> {
  protected readonly entityName = 'Warehouse';

  protected delegate(client: DatabaseClient): ModelDelegate<Warehouse> {
    return client.warehouse as unknown as ModelDelegate<Warehouse>;
  }

  buildSearchFilter(search?: string): Prisma.WarehouseWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { code: { contains: search } },
        { name: { contains: search } },
        { city: { contains: search } },
      ],
    };
  }

  async listActive(client?: DatabaseClient): Promise<Warehouse[]> {
    return this.findAll({ isActive: true }, { orderBy: { name: 'asc' } }, client);
  }

  async isCodeTaken(code: string, excludeId?: string, client?: DatabaseClient): Promise<boolean> {
    return this.exists(excludeId ? { code, id: { not: excludeId } } : { code }, client);
  }
}

export const warehouseRepository = new WarehouseRepository();
