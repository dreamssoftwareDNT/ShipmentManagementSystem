import { z } from 'zod';
import {
  codeSchema,
  currencyCodeSchema,
  dateSchema,
  idSchema,
  moneySchema,
  optionalEmailSchema,
  optionalIdSchema,
  optionalPhoneSchema,
  optionalText,
  pageRequestSchema,
  rateSchema,
  requiredText,
} from './common.schema';
import { ExchangeSettlementMode, PartyStatus, enumValues } from '@/types/enums';

export const clearingAgentBaseSchema = z.object({
  code: codeSchema(),
  name: requiredText(150, 'Agent name'),
  companyName: optionalText(180),
  licenseNumber: optionalText(60),
  contactPerson: optionalText(120),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  addressLine1: optionalText(200),
  city: optionalText(80),
  country: optionalText(80),
  portOfOperation: optionalText(120),
  currencyCode: currencyCodeSchema.default('USD'),
  paymentTermDays: z.coerce.number().int().min(0).max(365).default(15),
  status: z.enum(enumValues(PartyStatus)).default(PartyStatus.ACTIVE),
});

export const createClearingAgentSchema = clearingAgentBaseSchema;
export const updateClearingAgentSchema = clearingAgentBaseSchema.partial().extend({
  name: requiredText(150, 'Agent name'),
});

export const moneyChangerBaseSchema = z.object({
  code: codeSchema(),
  name: requiredText(150, 'Money changer name'),
  companyName: optionalText(180),
  licenseNumber: optionalText(60),
  contactPerson: optionalText(120),
  phone: optionalPhoneSchema,
  email: optionalEmailSchema,
  city: optionalText(80),
  country: optionalText(80),
  status: z.enum(enumValues(PartyStatus)).default(PartyStatus.ACTIVE),
});

export const createMoneyChangerSchema = moneyChangerBaseSchema;
export const updateMoneyChangerSchema = moneyChangerBaseSchema.partial().extend({
  name: requiredText(150, 'Money changer name'),
});

export const createCurrencyExchangeSchema = z
  .object({
    moneyChangerId: idSchema,
    shipmentId: optionalIdSchema,
    exchangeDate: dateSchema,
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    fromAmount: moneySchema.refine((value) => value > 0, 'Amount must be greater than zero'),
    rate: rateSchema,
    commission: moneySchema.default(0),
    settlementMode: z
      .enum(enumValues(ExchangeSettlementMode))
      .default(ExchangeSettlementMode.CASH),
    remarks: optionalText(400),
  })
  .refine((value) => value.fromCurrency !== value.toCurrency, {
    message: 'Source and target currency must be different',
    path: ['toCurrency'],
  });

export const currencyExchangeQuerySchema = pageRequestSchema.extend({
  moneyChangerId: z.string().trim().max(30).optional(),
  fromCurrency: z.string().trim().max(3).optional(),
  toCurrency: z.string().trim().max(3).optional(),
});

export const partnerQuerySchema = pageRequestSchema.extend({
  status: z.enum(enumValues(PartyStatus)).optional(),
  country: z.string().trim().max(80).optional(),
});

export const upsertCurrencyRateSchema = z.object({
  fromCurrencyId: idSchema,
  toCurrencyId: idSchema,
  rate: rateSchema,
  effectiveFrom: dateSchema,
  source: optionalText(60),
});

export type CreateClearingAgentInput = z.infer<typeof createClearingAgentSchema>;
export type CreateMoneyChangerInput = z.infer<typeof createMoneyChangerSchema>;
export type CreateCurrencyExchangeInput = z.infer<typeof createCurrencyExchangeSchema>;
export type CurrencyExchangeQueryInput = z.infer<typeof currencyExchangeQuerySchema>;
export type PartnerQueryInput = z.infer<typeof partnerQuerySchema>;
export type UpsertCurrencyRateInput = z.infer<typeof upsertCurrencyRateSchema>;
