import { z } from 'zod';
import {
  codeSchema,
  optionalIdSchema,
  optionalText,
  pageRequestSchema,
  requiredText,
} from './common.schema';
import { UnitOfMeasure, enumValues } from '@/types/enums';

const measureSchema = z.coerce.number().min(0).max(1_000_000).default(0);

export const productBaseSchema = z.object({
  sku: codeSchema(60),
  name: requiredText(200, 'Product name'),
  categoryId: optionalIdSchema,
  description: optionalText(4000),
  unitOfMeasure: z.enum(enumValues(UnitOfMeasure)).default(UnitOfMeasure.PCS),
  hsCode: optionalText(30),
  barcode: optionalText(60),
  brand: optionalText(120),
  unitWeightKg: measureSchema,
  unitVolumeCbm: measureSchema,
  reorderLevel: measureSchema,
  isActive: z.boolean().default(true),
});

export const createProductSchema = productBaseSchema;

export const updateProductSchema = productBaseSchema.partial().extend({
  name: requiredText(200, 'Product name'),
});

export const productQuerySchema = pageRequestSchema.extend({
  categoryId: z.string().trim().max(30).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const productCategorySchema = z.object({
  code: codeSchema(40),
  name: requiredText(120, 'Category name'),
  isActive: z.boolean().default(true),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type ProductCategoryInput = z.infer<typeof productCategorySchema>;
