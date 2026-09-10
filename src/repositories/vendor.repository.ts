import type { Prisma, Vendor } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import type { DatabaseClient } from '@/database/unit-of-work';

export class VendorRepository extends BaseRepository<Vendor> {
  protected readonly entityName = 'Vendor';

  protected delegate(client: DatabaseClient): ModelDelegate<Vendor> {
    return client.vendor as unknown as ModelDelegate<Vendor>;
  }

  buildSearchFilter(search?: string): Prisma.VendorWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { code: { contains: search } },
        { name: { contains: search } },
        { companyName: { contains: search } },
        { email: { contains: search } },
        { country: { contains: search } },
      ],
    };
  }

  async findByCode(code: string, client?: DatabaseClient): Promise<Vendor | null> {
    return this.findOne({ code }, {}, client);
  }

  async isCodeTaken(code: string, excludeId?: string, client?: DatabaseClient): Promise<boolean> {
    return this.exists(excludeId ? { code, id: { not: excludeId } } : { code }, client);
  }

  async listActiveOptions(client?: DatabaseClient): Promise<Vendor[]> {
    return this.findAll({ status: 'ACTIVE' }, { orderBy: { name: 'asc' } }, client);
  }
}

export const vendorRepository = new VendorRepository();
