import type { Prisma, Product, ProductCategory } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';

export class ProductCategoryRepository extends BaseRepository<ProductCategory> {
  protected readonly entityName = 'Product category';

  protected delegate(client: DatabaseClient): ModelDelegate<ProductCategory> {
    return client.productCategory as unknown as ModelDelegate<ProductCategory>;
  }

  async listActive(client?: DatabaseClient): Promise<ProductCategory[]> {
    return this.findAll({ isActive: true }, { orderBy: { name: 'asc' } }, client);
  }

  async isCodeTaken(code: string, excludeId?: string, client?: DatabaseClient): Promise<boolean> {
    return this.exists(excludeId ? { code, id: { not: excludeId } } : { code }, client);
  }
}

export class ProductRepository extends BaseRepository<Product> {
  protected readonly entityName = 'Product';

  protected delegate(client: DatabaseClient): ModelDelegate<Product> {
    return client.product as unknown as ModelDelegate<Product>;
  }

  buildSearchFilter(search?: string): Prisma.ProductWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { sku: { contains: search } },
        { name: { contains: search } },
        { barcode: { contains: search } },
        { hsCode: { contains: search } },
        { brand: { contains: search } },
      ],
    };
  }

  async isSkuTaken(sku: string, excludeId?: string, client?: DatabaseClient): Promise<boolean> {
    return this.exists(excludeId ? { sku, id: { not: excludeId } } : { sku }, client);
  }

  async listActiveOptions(client?: DatabaseClient): Promise<Product[]> {
    return this.findAll({ isActive: true }, { orderBy: { name: 'asc' } }, client);
  }

  async findDetail(id: string, client?: DatabaseClient) {
    return resolveClient(client).product.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: { select: { id: true, code: true, name: true } },
        stockBalances: { include: { warehouse: { select: { id: true, code: true, name: true } } } },
      },
    });
  }
}

export const productCategoryRepository = new ProductCategoryRepository();
export const productRepository = new ProductRepository();
