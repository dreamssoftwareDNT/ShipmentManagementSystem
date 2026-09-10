import type { VendorType } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import type { DatabaseClient } from '@/database/unit-of-work';

export class VendorTypeRepository extends BaseRepository<VendorType> {
  protected readonly entityName = 'Vendor type';

  protected delegate(client: DatabaseClient): ModelDelegate<VendorType> {
    return client.vendorType as unknown as ModelDelegate<VendorType>;
  }

  async listActive(client?: DatabaseClient): Promise<VendorType[]> {
    return this.findAll({ isActive: true }, { orderBy: { name: 'asc' } }, client);
  }
}

export const vendorTypeRepository = new VendorTypeRepository();
