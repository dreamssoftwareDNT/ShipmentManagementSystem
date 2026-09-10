import { Prisma } from '@prisma/client';

export type DecimalInput = Prisma.Decimal | number | string;

export const ZERO = new Prisma.Decimal(0);

const AMOUNT_SCALE = 4;
const RATE_SCALE = 8;

export function toDecimal(value: DecimalInput | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined || value === '') {
    return new Prisma.Decimal(0);
  }
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export function roundAmount(value: DecimalInput): Prisma.Decimal {
  return toDecimal(value).toDecimalPlaces(AMOUNT_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

export function roundRate(value: DecimalInput): Prisma.Decimal {
  return toDecimal(value).toDecimalPlaces(RATE_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

export function sum(values: DecimalInput[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((total, value) => total.plus(toDecimal(value)), ZERO);
}

export function isZero(value: DecimalInput): boolean {
  return toDecimal(value).isZero();
}

export function isNegative(value: DecimalInput): boolean {
  return toDecimal(value).isNegative();
}

export function isGreaterThan(left: DecimalInput, right: DecimalInput): boolean {
  return toDecimal(left).greaterThan(toDecimal(right));
}

export function convertToBase(amount: DecimalInput, exchangeRate: DecimalInput): Prisma.Decimal {
  return roundAmount(toDecimal(amount).times(toDecimal(exchangeRate)));
}

export interface LineCalculationInput {
  quantity: DecimalInput;
  unitRate: DecimalInput;
  discountRate?: DecimalInput;
  taxRate?: DecimalInput;
}

export interface LineCalculationResult {
  lineSubTotal: Prisma.Decimal;
  lineDiscountAmount: Prisma.Decimal;
  lineTaxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

/**
 * Discount is applied to the gross line value first, tax is then charged on the
 * discounted amount. This matches the sequence used on freight invoices.
 */
export function calculateLine(input: LineCalculationInput): LineCalculationResult {
  const gross = roundAmount(toDecimal(input.quantity).times(toDecimal(input.unitRate)));
  const discountAmount = roundAmount(gross.times(toDecimal(input.discountRate).dividedBy(100)));
  const net = roundAmount(gross.minus(discountAmount));
  const taxAmount = roundAmount(net.times(toDecimal(input.taxRate).dividedBy(100)));

  return {
    lineSubTotal: net,
    lineDiscountAmount: discountAmount,
    lineTaxAmount: taxAmount,
    lineTotal: roundAmount(net.plus(taxAmount)),
  };
}

export interface DocumentTotals {
  subTotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}

export function calculateDocumentTotals(lines: LineCalculationResult[]): DocumentTotals {
  const subTotal = sum(lines.map((line) => line.lineSubTotal));
  const discountTotal = sum(lines.map((line) => line.lineDiscountAmount));
  const taxTotal = sum(lines.map((line) => line.lineTaxAmount));

  return {
    subTotal,
    discountTotal,
    taxTotal,
    grandTotal: roundAmount(subTotal.plus(taxTotal)),
  };
}

export function formatMoney(
  value: DecimalInput | null | undefined,
  currencyCode = 'USD',
  locale = 'en-US',
): string {
  const amount = toDecimal(value).toNumber();

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(
  value: DecimalInput | null | undefined,
  fractionDigits = 2,
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toDecimal(value).toNumber());
}

export function decimalToString(value: DecimalInput | null | undefined): string {
  return toDecimal(value).toFixed(AMOUNT_SCALE);
}
