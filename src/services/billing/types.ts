export interface PaymentAllocationInput {
  invoiceId: string;
  amount: number;
}

export interface PartyReference {
  id: string;
  name: string;
  currencyCode: string;
}
