import { z } from 'zod';
import {
  currencyCodeSchema,
  idSchema,
  moneySchema,
  optionalDateSchema,
  optionalIdSchema,
  optionalText,
  pageRequestSchema,
  quantitySchema,
  rateSchema,
  requiredText,
} from './common.schema';
import {
  ContainerType,
  CostAllocationBasis,
  CostGroup,
  DocumentType,
  ServiceType,
  ShipmentStatus,
  ShipmentType,
  TransportMode,
  enumValues,
} from '@/types/enums';

const weightSchema = z.coerce.number().min(0).max(10_000_000).default(0);

export const shipmentItemSchema = z.object({
  productId: idSchema,
  description: optionalText(300),
  quantityOrdered: quantitySchema,
  unitPrice: moneySchema,
  currencyCode: currencyCodeSchema.default('USD'),
});

export const shipmentBaseSchema = z.object({
  supplierVendorId: idSchema,
  carrierVendorId: optionalIdSchema,
  clearingAgentId: optionalIdSchema,
  supplierInvoiceNo: optionalText(60),
  supplierInvoiceDate: optionalDateSchema,
  shipmentType: z.enum(enumValues(ShipmentType)).default(ShipmentType.IMPORT),
  transportMode: z.enum(enumValues(TransportMode)),
  serviceType: z.enum(enumValues(ServiceType)).default(ServiceType.PORT_TO_PORT),
  incoterm: optionalText(10),
  originCountry: optionalText(80),
  originPort: requiredText(120, 'Origin port'),
  destinationCountry: optionalText(80),
  destinationPort: requiredText(120, 'Destination port'),
  bookingNo: optionalText(60),
  masterBlNo: optionalText(60),
  houseBlNo: optionalText(60),
  vesselName: optionalText(120),
  voyageNo: optionalText(40),
  flightNo: optionalText(40),
  goodsDeclarationNo: optionalText(60),
  cargoDescription: optionalText(4000),
  packageCount: z.coerce.number().int().min(0).max(1_000_000).default(0),
  packageType: optionalText(40),
  grossWeightKg: weightSchema,
  netWeightKg: weightSchema,
  volumeCbm: weightSchema,
  chargeableWeight: weightSchema,
  isHazardous: z.boolean().default(false),
  requiresTempControl: z.boolean().default(false),
  orderDate: optionalDateSchema,
  bookingDate: optionalDateSchema,
  cargoReceivedDate: optionalDateSchema,
  shippingDate: optionalDateSchema,
  expectedArrival: optionalDateSchema,
  supplierCurrency: currencyCodeSchema.default('USD'),
  exchangeRate: rateSchema.default(1),
  baseCurrency: currencyCodeSchema.default('PKR'),
  costAllocationBasis: z
    .enum(enumValues(CostAllocationBasis))
    .default(CostAllocationBasis.VALUE),
  remarks: optionalText(4000),
});

export const createShipmentSchema = shipmentBaseSchema
  .extend({
    items: z.array(shipmentItemSchema).max(500).default([]),
  })
  .refine(
    (value) =>
      !value.shippingDate || !value.expectedArrival || value.shippingDate <= value.expectedArrival,
    {
      message: 'Expected arrival cannot be earlier than the shipping date',
      path: ['expectedArrival'],
    },
  );

export const updateShipmentSchema = shipmentBaseSchema.partial().extend({
  originPort: requiredText(120, 'Origin port'),
  destinationPort: requiredText(120, 'Destination port'),
  items: z.array(shipmentItemSchema).max(500).optional(),
});

export const shipmentQuerySchema = pageRequestSchema.extend({
  status: z.enum(enumValues(ShipmentStatus)).optional(),
  supplierVendorId: z.string().trim().max(30).optional(),
  carrierVendorId: z.string().trim().max(30).optional(),
  transportMode: z.enum(enumValues(TransportMode)).optional(),
  from: optionalDateSchema,
  to: optionalDateSchema,
});

export const changeShipmentStatusSchema = z.object({
  status: z.enum(enumValues(ShipmentStatus)),
  remarks: optionalText(400),
  occurredAt: optionalDateSchema,
});

export const shipmentContainerSchema = z.object({
  containerNo: requiredText(20, 'Container number').regex(
    /^[A-Za-z]{4}[0-9]{7}$/,
    'Container number must be four letters followed by seven digits',
  ),
  containerType: z.enum(enumValues(ContainerType)),
  sealNo: optionalText(40),
  tareWeightKg: weightSchema,
  grossWeightKg: weightSchema,
  volumeCbm: weightSchema,
  packageCount: z.coerce.number().int().min(0).default(0),
  loadedAt: optionalDateSchema,
  dischargedAt: optionalDateSchema,
});

export const shipmentChargeSchema = z.object({
  costGroup: z.enum(enumValues(CostGroup)).default(CostGroup.OTHER),
  description: requiredText(200, 'Description'),
  quantity: quantitySchema.default(1),
  unitRate: moneySchema,
  currencyCode: currencyCodeSchema.default('PKR'),
  exchangeRate: rateSchema.default(1),
});

export const allocationBasisSchema = z.object({
  costAllocationBasis: z.enum(enumValues(CostAllocationBasis)),
});

export const trackingEventSchema = z.object({
  eventCode: requiredText(40, 'Event code'),
  description: requiredText(300, 'Description'),
  location: optionalText(150),
  occurredAt: z.coerce.date(),
  isPublic: z.boolean().default(true),
});

export const shipmentDocumentMetaSchema = z.object({
  documentType: z.enum(enumValues(DocumentType)),
  title: requiredText(200, 'Document title'),
  issuedDate: optionalDateSchema,
  expiryDate: optionalDateSchema,
  remarks: optionalText(400),
});

export type ShipmentItemInput = z.infer<typeof shipmentItemSchema>;
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;
export type ShipmentQueryInput = z.infer<typeof shipmentQuerySchema>;
export type ChangeShipmentStatusInput = z.infer<typeof changeShipmentStatusSchema>;
export type ShipmentContainerInput = z.infer<typeof shipmentContainerSchema>;
export type ShipmentChargeInput = z.infer<typeof shipmentChargeSchema>;
export type AllocationBasisInput = z.infer<typeof allocationBasisSchema>;
export type TrackingEventInput = z.infer<typeof trackingEventSchema>;
export type ShipmentDocumentMetaInput = z.infer<typeof shipmentDocumentMetaSchema>;
