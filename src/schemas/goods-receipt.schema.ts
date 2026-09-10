import { z } from 'zod';
import {
  codeSchema,
  dateSchema,
  idSchema,
  optionalDateSchema,
  optionalText,
  pageRequestSchema,
  requiredText,
} from './common.schema';
import { GoodsReceiptStatus, enumValues } from '@/types/enums';

export const goodsReceiptItemSchema = z.object({
  shipmentItemId: idSchema,
  quantityReceived: z.coerce
    .number()
    .positive('Received quantity must be greater than zero')
    .max(100_000_000),
  quantityDamaged: z.coerce.number().min(0).max(100_000_000).default(0),
  batchNo: optionalText(60),
  remarks: optionalText(300),
});

export const createGoodsReceiptSchema = z.object({
  shipmentId: idSchema,
  warehouseId: idSchema,
  receiptDate: dateSchema,
  remarks: optionalText(4000),
  items: z
    .array(goodsReceiptItemSchema)
    .min(1, 'Receive at least one line')
    .max(300, 'A receipt cannot exceed 300 lines'),
});

export const goodsReceiptQuerySchema = pageRequestSchema.extend({
  status: z.enum(enumValues(GoodsReceiptStatus)).optional(),
  shipmentId: z.string().trim().max(30).optional(),
  warehouseId: z.string().trim().max(30).optional(),
  from: optionalDateSchema,
  to: optionalDateSchema,
});

export const inventoryQuerySchema = pageRequestSchema.extend({
  warehouseId: z.string().trim().max(30).optional(),
  categoryId: z.string().trim().max(30).optional(),
  inStockOnly: z.coerce.boolean().optional(),
});

export const warehouseSchema = z.object({
  code: codeSchema(30),
  name: requiredText(120, 'Warehouse name'),
  address: optionalText(300),
  city: optionalText(80),
  isActive: z.boolean().default(true),
});

export type GoodsReceiptItemInput = z.infer<typeof goodsReceiptItemSchema>;
export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;
export type GoodsReceiptQueryInput = z.infer<typeof goodsReceiptQuerySchema>;
export type InventoryQueryInput = z.infer<typeof inventoryQuerySchema>;
export type WarehouseInput = z.infer<typeof warehouseSchema>;
export type { CancelDocumentInput } from './billing.schema';
