import { z } from 'zod';

export const idSchema = z.string().min(1, 'Identifier is required').max(30);

export const optionalIdSchema = z
  .union([idSchema, z.literal(''), z.null()])
  .transform((value) => (value ? value : null))
  .nullable()
  .optional();

export const currencyCodeSchema = z
  .string()
  .trim()
  .length(3, 'Currency code must be three characters')
  .transform((value) => value.toUpperCase());

export const moneySchema = z.coerce
  .number()
  .refine((value) => Number.isFinite(value), 'Amount must be a number')
  .refine((value) => value >= 0, 'Amount cannot be negative')
  .refine((value) => value <= 999_999_999_999, 'Amount is out of range');

export const signedMoneySchema = z.coerce
  .number()
  .refine((value) => Number.isFinite(value), 'Amount must be a number');

export const rateSchema = z.coerce
  .number()
  .positive('Exchange rate must be greater than zero')
  .max(1_000_000, 'Exchange rate is out of range');

export const percentageSchema = z.coerce
  .number()
  .min(0, 'Percentage cannot be negative')
  .max(100, 'Percentage cannot exceed 100');

export const quantitySchema = z.coerce
  .number()
  .positive('Quantity must be greater than zero')
  .max(1_000_000, 'Quantity is out of range');

export const dateSchema = z.coerce.date({ invalid_type_error: 'Enter a valid date' });

export const optionalDateSchema = z
  .union([z.coerce.date(), z.literal(''), z.null()])
  .transform((value) => (value instanceof Date ? value : null))
  .nullable()
  .optional();

export const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address')
  .max(180)
  .transform((value) => value.toLowerCase());

export const optionalEmailSchema = z
  .union([emailSchema, z.literal('')])
  .transform((value) => (value ? value : null))
  .nullable()
  .optional();

export const phoneSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[+]?[0-9\s\-()]{6,40}$/, 'Enter a valid phone number');

export const optionalPhoneSchema = z
  .union([phoneSchema, z.literal('')])
  .transform((value) => (value ? value : null))
  .nullable()
  .optional();

export function optionalText(max: number) {
  return z
    .union([z.string().trim().max(max), z.literal('')])
    .transform((value) => (value ? value : null))
    .nullable()
    .optional();
}

export function requiredText(max: number, label = 'This field') {
  return z.string().trim().min(1, `${label} is required`).max(max);
}

export function codeSchema(max = 30) {
  return z
    .string()
    .trim()
    .min(2, 'Code must be at least two characters')
    .max(max)
    .regex(/^[A-Za-z0-9._-]+$/, 'Code may only contain letters, digits, dot, dash or underscore')
    .transform((value) => value.toUpperCase());
}

export const pageRequestSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(25),
  sortBy: z.string().trim().max(60).optional(),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(120).optional(),
});

export type PageRequestInput = z.infer<typeof pageRequestSchema>;

export const dateRangeSchema = z
  .object({
    from: optionalDateSchema,
    to: optionalDateSchema,
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'The start date must be on or before the end date',
    path: ['to'],
  });
