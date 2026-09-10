export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const PartyStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
} as const;
export type PartyStatus = (typeof PartyStatus)[keyof typeof PartyStatus];

export const RoleCode = {
  ADMIN: 'ADMIN',
  OPERATIONS_MANAGER: 'OPERATIONS_MANAGER',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
  ACCOUNTANT: 'ACCOUNTANT',
  SHIPMENT_MANAGER: 'SHIPMENT_MANAGER',
  WAREHOUSE_MANAGER: 'WAREHOUSE_MANAGER',
  VIEWER: 'VIEWER',
} as const;
export type RoleCode = (typeof RoleCode)[keyof typeof RoleCode];

export const ShipmentStatus = {
  DRAFT: 'DRAFT',
  ORDERED: 'ORDERED',
  SHIPPED: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVED: 'ARRIVED',
  CUSTOM_CLEARANCE: 'CUSTOM_CLEARANCE',
  RECEIVED: 'RECEIVED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

/**
 * The import journey: we place an order, the supplier ships it, it travels,
 * lands, clears customs, the goods enter stock, and the file is closed once
 * every cost has been booked.
 */
export const SHIPMENT_STATUS_SEQUENCE: readonly ShipmentStatus[] = [
  ShipmentStatus.DRAFT,
  ShipmentStatus.ORDERED,
  ShipmentStatus.SHIPPED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ARRIVED,
  ShipmentStatus.CUSTOM_CLEARANCE,
  ShipmentStatus.RECEIVED,
  ShipmentStatus.CLOSED,
];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  DRAFT: 'Draft',
  ORDERED: 'Order placed',
  SHIPPED: 'Shipped by supplier',
  IN_TRANSIT: 'In transit',
  ARRIVED: 'Arrived at port',
  CUSTOM_CLEARANCE: 'Customs clearance',
  RECEIVED: 'Received in stock',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export const ShipmentType = {
  IMPORT: 'IMPORT',
  LOCAL_PURCHASE: 'LOCAL_PURCHASE',
} as const;
export type ShipmentType = (typeof ShipmentType)[keyof typeof ShipmentType];

export const TransportMode = {
  SEA_FCL: 'SEA_FCL',
  SEA_LCL: 'SEA_LCL',
  AIR: 'AIR',
  ROAD: 'ROAD',
  RAIL: 'RAIL',
  COURIER: 'COURIER',
} as const;
export type TransportMode = (typeof TransportMode)[keyof typeof TransportMode];

export const ServiceType = {
  PORT_TO_PORT: 'PORT_TO_PORT',
  DOOR_TO_DOOR: 'DOOR_TO_DOOR',
  PORT_TO_DOOR: 'PORT_TO_DOOR',
  DOOR_TO_PORT: 'DOOR_TO_PORT',
} as const;
export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType];

export const ContainerType = {
  GP20: 'GP20',
  GP40: 'GP40',
  HC40: 'HC40',
  HC45: 'HC45',
  RF20: 'RF20',
  RF40: 'RF40',
  OT20: 'OT20',
  OT40: 'OT40',
  LCL: 'LCL',
} as const;
export type ContainerType = (typeof ContainerType)[keyof typeof ContainerType];

/**
 * How a cost is grouped on the shipment cost sheet. GOODS is the merchandise
 * value itself, which arrives through the shipment line items and is never
 * allocated a second time.
 */
export const CostGroup = {
  GOODS: 'GOODS',
  FREIGHT: 'FREIGHT',
  INSURANCE: 'INSURANCE',
  DUTY: 'DUTY',
  CLEARING: 'CLEARING',
  PORT_CHARGES: 'PORT_CHARGES',
  TRANSPORT: 'TRANSPORT',
  BANK_CHARGES: 'BANK_CHARGES',
  OTHER: 'OTHER',
} as const;
export type CostGroup = (typeof CostGroup)[keyof typeof CostGroup];

export const COST_GROUP_LABELS: Record<CostGroup, string> = {
  GOODS: 'Goods value',
  FREIGHT: 'Freight',
  INSURANCE: 'Insurance',
  DUTY: 'Customs duty and taxes',
  CLEARING: 'Clearing and handling',
  PORT_CHARGES: 'Port and terminal charges',
  TRANSPORT: 'Inland transport',
  BANK_CHARGES: 'Bank and exchange charges',
  OTHER: 'Other',
};

/** Basis used to spread shipment level costs across the line items. */
export const CostAllocationBasis = {
  VALUE: 'VALUE',
  QUANTITY: 'QUANTITY',
  WEIGHT: 'WEIGHT',
  VOLUME: 'VOLUME',
} as const;
export type CostAllocationBasis =
  (typeof CostAllocationBasis)[keyof typeof CostAllocationBasis];

export const COST_ALLOCATION_LABELS: Record<CostAllocationBasis, string> = {
  VALUE: 'By goods value',
  QUANTITY: 'By quantity',
  WEIGHT: 'By weight',
  VOLUME: 'By volume',
};

export const DocumentType = {
  COMMERCIAL_INVOICE: 'COMMERCIAL_INVOICE',
  PACKING_LIST: 'PACKING_LIST',
  BILL_OF_LADING: 'BILL_OF_LADING',
  AIR_WAYBILL: 'AIR_WAYBILL',
  CERTIFICATE_OF_ORIGIN: 'CERTIFICATE_OF_ORIGIN',
  GOODS_DECLARATION: 'GOODS_DECLARATION',
  DUTY_RECEIPT: 'DUTY_RECEIPT',
  DELIVERY_ORDER: 'DELIVERY_ORDER',
  INSURANCE_CERTIFICATE: 'INSURANCE_CERTIFICATE',
  ARRIVAL_NOTICE: 'ARRIVAL_NOTICE',
  BANK_DOCUMENT: 'BANK_DOCUMENT',
  OTHER: 'OTHER',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const PurchaseOrderStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type PurchaseOrderStatus =
  (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentStatus = {
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMethod = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CHEQUE: 'CHEQUE',
  LETTER_OF_CREDIT: 'LETTER_OF_CREDIT',
  TELEGRAPHIC_TRANSFER: 'TELEGRAPHIC_TRANSFER',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const ExpenseStatus = {
  RECORDED: 'RECORDED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ExpenseStatus = (typeof ExpenseStatus)[keyof typeof ExpenseStatus];

export const GoodsReceiptStatus = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
} as const;
export type GoodsReceiptStatus =
  (typeof GoodsReceiptStatus)[keyof typeof GoodsReceiptStatus];

export const StockMovementType = {
  RECEIPT: 'RECEIPT',
  RETURN: 'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
  COST_REVALUATION: 'COST_REVALUATION',
} as const;
export type StockMovementType =
  (typeof StockMovementType)[keyof typeof StockMovementType];

export const LedgerPartyType = {
  VENDOR: 'VENDOR',
  CLEARING_AGENT: 'CLEARING_AGENT',
  MONEY_CHANGER: 'MONEY_CHANGER',
} as const;
export type LedgerPartyType = (typeof LedgerPartyType)[keyof typeof LedgerPartyType];

export const LedgerEntryType = {
  INVOICE: 'INVOICE',
  PAYMENT: 'PAYMENT',
  CREDIT_NOTE: 'CREDIT_NOTE',
  DEBIT_NOTE: 'DEBIT_NOTE',
  OPENING_BALANCE: 'OPENING_BALANCE',
  EXCHANGE: 'EXCHANGE',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType];

export const LedgerReferenceType = {
  VENDOR_INVOICE: 'VENDOR_INVOICE',
  VENDOR_PAYMENT: 'VENDOR_PAYMENT',
  AGENT_INVOICE: 'AGENT_INVOICE',
  AGENT_PAYMENT: 'AGENT_PAYMENT',
  CURRENCY_EXCHANGE: 'CURRENCY_EXCHANGE',
  MANUAL: 'MANUAL',
} as const;
export type LedgerReferenceType =
  (typeof LedgerReferenceType)[keyof typeof LedgerReferenceType];

export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  RESTORE: 'RESTORE',
  APPROVE: 'APPROVE',
  CANCEL: 'CANCEL',
  POST: 'POST',
  STATUS_CHANGE: 'STATUS_CHANGE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET: 'PASSWORD_RESET',
  UPLOAD: 'UPLOAD',
  RECALCULATE: 'RECALCULATE',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const ExchangeSettlementMode = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type ExchangeSettlementMode =
  (typeof ExchangeSettlementMode)[keyof typeof ExchangeSettlementMode];

export const UnitOfMeasure = {
  PCS: 'PCS',
  BOX: 'BOX',
  CTN: 'CTN',
  KG: 'KG',
  GRAM: 'GRAM',
  TON: 'TON',
  LITRE: 'LITRE',
  METRE: 'METRE',
  ROLL: 'ROLL',
  SET: 'SET',
  PAIR: 'PAIR',
  DOZEN: 'DOZEN',
} as const;
export type UnitOfMeasure = (typeof UnitOfMeasure)[keyof typeof UnitOfMeasure];

export function enumValues<T extends Record<string, string>>(source: T): [string, ...string[]] {
  const values = Object.values(source);
  return values as [string, ...string[]];
}
