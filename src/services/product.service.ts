import type { Prisma, Product, ProductCategory } from '@prisma/client';
import { BaseService } from './base.service';
import {
  productCategoryRepository,
  productRepository,
} from '@/repositories/product.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { UnitOfWork } from '@/database/unit-of-work';
import { BusinessRuleError } from '@/lib/errors';
import { AuditAction } from '@/types/enums';
import type {
  CreateProductInput,
  ProductCategoryInput,
  ProductQueryInput,
  UpdateProductInput,
} from '@/schemas/product.schema';
import type { PageResult, RequestContext, SelectOption } from '@/types/common';

export class ProductService extends BaseService {
  private readonly entityName = 'Product';

  async list(query: ProductQueryInput): Promise<PageResult<Product>> {
    const page = this.normalizePage(query);

    const where: Prisma.ProductWhereInput = {
      ...productRepository.buildSearchFilter(page.search),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    return productRepository.paginate(where, page, {
      include: {
        category: { select: { id: true, code: true, name: true } },
        stockBalances: { select: { quantityOnHand: true, averageUnitCost: true } },
      },
      orderBy: page.sortBy ? { [page.sortBy]: page.sortDirection } : { name: 'asc' },
    });
  }

  async getDetail(id: string) {
    const product = await productRepository.findDetail(id);

    if (!product) {
      await productRepository.requireById(id);
      throw new BusinessRuleError('Product could not be resolved');
    }

    return product;
  }

  async options(): Promise<SelectOption[]> {
    const products = await productRepository.listActiveOptions();

    return products.map((product) => ({
      value: product.id,
      label: product.name,
      hint: `${product.sku} · ${product.unitOfMeasure}`,
    }));
  }

  async create(input: CreateProductInput, context: RequestContext): Promise<Product> {
    return UnitOfWork.run(async (tx) => {
      this.assertUnique(
        await productRepository.isSkuTaken(input.sku, undefined, tx),
        'sku',
        `SKU ${input.sku} is already in use`,
      );

      const product = await productRepository.create(
        { ...input },
        { userId: context.user.id },
        tx,
      );

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: product.id,
          action: AuditAction.CREATE,
          summary: `Created product ${product.sku} - ${product.name}`,
        },
        tx,
      );

      return product;
    });
  }

  async update(
    id: string,
    input: UpdateProductInput,
    context: RequestContext,
  ): Promise<Product> {
    return UnitOfWork.run(async (tx) => {
      const existing = await productRepository.requireById(id, {}, tx);

      if (input.sku && input.sku !== existing.sku) {
        this.assertUnique(
          await productRepository.isSkuTaken(input.sku, id, tx),
          'sku',
          `SKU ${input.sku} is already in use`,
        );
      }

      const updated = await productRepository.update(
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
          summary: `Updated product ${updated.sku}`,
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

  /**
   * Products are archived, never removed, because shipment lines and stock
   * movements reference them for the life of the record.
   */
  async remove(id: string, context: RequestContext): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      const product = await productRepository.requireById(id, {}, tx);

      const stock = await tx.stockBalance.findFirst({
        where: { productId: id, quantityOnHand: { gt: 0 } },
      });

      if (stock) {
        throw new BusinessRuleError(
          `${product.name} still has stock on hand and cannot be archived`,
        );
      }

      const openLines = await tx.shipmentItem.count({
        where: {
          productId: id,
          deletedAt: null,
          shipment: { deletedAt: null, status: { notIn: ['CLOSED', 'CANCELLED'] } },
        },
      });

      if (openLines > 0) {
        throw new BusinessRuleError(
          `${product.name} appears on ${openLines} open shipment line(s) and cannot be archived`,
        );
      }

      await productRepository.softDelete(id, { userId: context.user.id }, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Archived product ${product.sku}`,
        },
        tx,
      );
    });
  }

  async history(id: string) {
    return auditLogRepository.listForEntity(this.entityName, id);
  }

  async categoryOptions(): Promise<SelectOption[]> {
    const categories = await productCategoryRepository.listActive();

    return categories.map((category) => ({
      value: category.id,
      label: category.name,
      hint: category.code,
    }));
  }

  async listCategories(): Promise<ProductCategory[]> {
    return productCategoryRepository.findAll({}, { orderBy: { name: 'asc' } });
  }

  async createCategory(
    input: ProductCategoryInput,
    context: RequestContext,
  ): Promise<ProductCategory> {
    return UnitOfWork.run(async (tx) => {
      this.assertUnique(
        await productCategoryRepository.isCodeTaken(input.code, undefined, tx),
        'code',
        `Category code ${input.code} is already in use`,
      );

      const category = await productCategoryRepository.create(
        { ...input },
        { userId: context.user.id },
        tx,
      );

      await this.writeAudit(
        context,
        {
          entityName: 'Product category',
          entityId: category.id,
          action: AuditAction.CREATE,
          summary: `Created product category ${category.name}`,
        },
        tx,
      );

      return category;
    });
  }

  async removeCategory(id: string, context: RequestContext): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      const category = await productCategoryRepository.requireById(id, {}, tx);

      const inUse = await tx.product.count({ where: { categoryId: id, deletedAt: null } });

      if (inUse > 0) {
        throw new BusinessRuleError(
          `${category.name} is used by ${inUse} product(s) and cannot be archived`,
        );
      }

      await productCategoryRepository.softDelete(id, { userId: context.user.id }, tx);

      await this.writeAudit(
        context,
        {
          entityName: 'Product category',
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Archived product category ${category.name}`,
        },
        tx,
      );
    });
  }
}

export const productService = new ProductService();
