import { z } from 'zod';
import {
  currencyCodeSchema,
  dateSchema,
  idSchema,
  moneySchema,
  optionalDateSchema,
  optionalIdSchema,
  optionalText,
  pageRequestSchema,
  rateSchema,
  requiredText,
} from './common.schema';
import { ExpenseStatus, PaymentMethod, enumValues } from '@/types/enums';

export const createExpenseSchema = z.object({
  categoryId: idSchema,
  shipmentId: optionalIdSchema,
  expenseDate: dateSchema,
  description: requiredText(300, 'Description'),
  currencyCode: currencyCodeSchema.default('PKR'),
  exchangeRate: rateSchema.default(1),
  amount: moneySchema.refine((value) => value > 0, 'Amount must be greater than zero'),
  taxAmount: moneySchema.default(0),
  paymentMethod: z.enum(enumValues(PaymentMethod)).default(PaymentMethod.CASH),
  isLandedCost: z.boolean().default(true),
  referenceNo: optionalText(80),
});

export const updateExpenseSchema = createExpenseSchema;

export const expenseQuerySchema = pageRequestSchema.extend({
  categoryId: z.string().trim().max(30).optional(),
  shipmentId: z.string().trim().max(30).optional(),
  status: z.enum(enumValues(ExpenseStatus)).optional(),
  from: optionalDateSchema,
  to: optionalDateSchema,
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ExpenseQueryInput = z.infer<typeof expenseQuerySchema>;
