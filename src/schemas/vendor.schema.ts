import { z } from 'zod';
import {
  codeSchema,
  currencyCodeSchema,
  idSchema,
  optionalEmailSchema,
  optionalPhoneSchema,
  optionalText,
  pageRequestSchema,
  requiredText,
} from './common.schema';
import { PartyStatus, enumValues } from '@/types/enums';

export const vendorBaseSchema = z.object({
  code: codeSchema(),
  vendorTypeId: idSchema,
  name: requiredText(150, 'Vendor name'),
  companyName: optionalText(180),
  contactPerson: optionalText(120),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(80),
  country: optionalText(80),
  taxNumber: optionalText(60),
  currencyCode: currencyCodeSchema.default('USD'),
  paymentTermDays: z.coerce.number().int().min(0).max(365).default(30),
  status: z.enum(enumValues(PartyStatus)).default(PartyStatus.ACTIVE),
  scacCode: optionalText(20),
  notes: optionalText(4000),
});

export const createVendorSchema = vendorBaseSchema;

export const updateVendorSchema = vendorBaseSchema.partial().extend({
  name: requiredText(150, 'Vendor name'),
});

export const vendorQuerySchema = pageRequestSchema.extend({
  status: z.enum(enumValues(PartyStatus)).optional(),
  vendorTypeId: z.string().trim().max(30).optional(),
  country: z.string().trim().max(80).optional(),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type VendorQueryInput = z.infer<typeof vendorQuerySchema>;
