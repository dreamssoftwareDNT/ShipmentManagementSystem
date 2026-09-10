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
  percentageSchema,
  quantitySchema,
  rateSchema,
  requiredText,
} from './common.schema';
import {
  CostGroup,
  InvoiceStatus,
  PaymentMethod,
  PurchaseOrderStatus,
  enumValues,
} from '@/types/enums';

export const documentLineSchema = z.object({
  description: requiredText(300, 'Description'),
  serviceCode: optionalText(40),
  quantity: quantitySchema.default(1),
  unitRate: moneySchema,
  discountRate: percentageSchema.default(0),
  taxRate: percentageSchema.default(0),
});

const lineListSchema = z
  .array(documentLineSchema)
  .min(1, 'Add at least one line item')
  .max(200, 'A document cannot exceed 200 line items');

export const createPurchaseOrderSchema = z.object({
  vendorId: idSchema,
  shipmentId: optionalIdSchema,
  orderDate: dateSchema,
  expectedDate: optionalDateSchema,
  currencyCode: currencyCodeSchema.default('USD'),
  exchangeRate: rateSchema.default(1),
  terms: optionalText(4000),
  remarks: optionalText(4000),
  items: lineListSchema,
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema;

export const purchaseOrderQuerySchema = pageRequestSchema.extend({
  status: z.enum(enumValues(PurchaseOrderStatus)).optional(),
  vendorId: z.string().trim().max(30).optional(),
  shipmentId: z.string().trim().max(30).optional(),
  from: optionalDateSchema,
  to: optionalDateSchema,
});

export const createVendorInvoiceSchema = z
  .object({
    vendorId: idSchema,
    vendorRefNo: optionalText(60),
    costGroup: z.enum(enumValues(CostGroup)).default(CostGroup.FREIGHT),
    shipmentId: optionalIdSchema,
    purchaseOrderId: optionalIdSchema,
    invoiceDate: dateSchema,
    dueDate: dateSchema,
    currencyCode: currencyCodeSchema.default('USD'),
    exchangeRate: rateSchema.default(1),
    remarks: optionalText(4000),
    items: lineListSchema,
  })
  .refine((value) => value.dueDate >= value.invoiceDate, {
    message: 'Due date cannot be earlier than the invoice date',
    path: ['dueDate'],
  });

export const createAgentInvoiceSchema = z
  .object({
    clearingAgentId: idSchema,
    agentRefNo: optionalText(60),
    shipmentId: optionalIdSchema,
    invoiceDate: dateSchema,
    dueDate: dateSchema,
    currencyCode: currencyCodeSchema.default('USD'),
    exchangeRate: rateSchema.default(1),
    dutyAmount: moneySchema.default(0),
    salesTaxAmount: moneySchema.default(0),
    reimbursable: moneySchema.default(0),
    remarks: optionalText(4000),
    items: lineListSchema,
  })
  .refine((value) => value.dueDate >= value.invoiceDate, {
    message: 'Due date cannot be earlier than the invoice date',
    path: ['dueDate'],
  });

export const invoiceQuerySchema = pageRequestSchema.extend({
  status: z.enum(enumValues(InvoiceStatus)).optional(),
  partyId: z.string().trim().max(30).optional(),
  shipmentId: z.string().trim().max(30).optional(),
  from: optionalDateSchema,
  to: optionalDateSchema,
  overdueOnly: z.coerce.boolean().optional(),
});

export const paymentAllocationSchema = z.object({
  invoiceId: idSchema,
  amount: moneySchema.refine((value) => value > 0, 'Allocation amount must be greater than zero'),
});

export const createPaymentSchema = z.object({
  partyId: idSchema,
  paymentDate: dateSchema,
  paymentMethod: z.enum(enumValues(PaymentMethod)),
  currencyCode: currencyCodeSchema.default('USD'),
  exchangeRate: rateSchema.default(1),
  amount: moneySchema.refine((value) => value > 0, 'Payment amount must be greater than zero'),
  bankAccount: optionalText(80),
  referenceNo: optionalText(80),
  chequeNo: optionalText(60),
  chequeDate: optionalDateSchema,
  remarks: optionalText(4000),
  allocations: z.array(paymentAllocationSchema).max(100).default([]),
});

export const paymentQuerySchema = pageRequestSchema.extend({
  partyId: z.string().trim().max(30).optional(),
  paymentMethod: z.enum(enumValues(PaymentMethod)).optional(),
  from: optionalDateSchema,
  to: optionalDateSchema,
});

export const cancelDocumentSchema = z.object({
  reason: requiredText(400, 'Cancellation reason'),
});

export type DocumentLineInput = z.infer<typeof documentLineSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type PurchaseOrderQueryInput = z.infer<typeof purchaseOrderQuerySchema>;
export type CreateVendorInvoiceInput = z.infer<typeof createVendorInvoiceSchema>;
export type CreateAgentInvoiceInput = z.infer<typeof createAgentInvoiceSchema>;
export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentQueryInput = z.infer<typeof paymentQuerySchema>;
export type CancelDocumentInput = z.infer<typeof cancelDocumentSchema>;
