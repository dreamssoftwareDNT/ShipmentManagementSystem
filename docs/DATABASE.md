# Database design

Microsoft SQL Server, accessed through Prisma. 33 tables in five groups.

## 1. Entity groups

### Identity and access

```
Users ──< UserRoles >── Roles ──< RolePermissions >── Permissions
  │
  ├──< Sessions
  ├──< PasswordResetTokens
  ├──< LoginAttempts
  └──< AuditLogs
```

`Users` holds the bcrypt hash, lockout counters and last sign-in. `Sessions`
stores a SHA-256 fingerprint of an opaque token, never the token itself, so a
database leak cannot be replayed as a login. `Permissions` are `MODULE:ACTION`
rows; roles reach them through the join table.

### Reference data

`Currencies`, `CurrencyRates`, `VendorTypes`, `ExpenseCategories`,
`ServiceCharges`, `NumberSequences`, `CompanyProfile`.

`NumberSequences` is the gap-free document numbering table. It is keyed on
`(key, period)` and incremented inside the caller's transaction, so a rolled back
document releases its number.

`CurrencyRates` is effective dated on `(fromCurrencyId, toCurrencyId,
effectiveFrom)`. A document resolves the rate current on its own date rather
than today's rate.

### Business partners

```
Customers        (billed for services)
Vendors ──> VendorTypes
ClearingAgents   (customs brokers, by port)
MoneyChangers ──< CurrencyExchanges
```

All four are coded master records with currency, payment terms and status. They
are never hard deleted, because historic documents reference them.

### Shipment operations

```
Shipments ──> Customers
     │    ──> Vendors           (carrier)
     │    ──> ClearingAgents
     ├──< ShipmentContainers
     ├──< ShipmentDocuments
     ├──< ShipmentStatusHistory
     ├──< ShipmentTrackingEvents
     └──< ShipmentCharges
```

`Shipments` is the operational spine. It carries routing, cargo, milestone dates
and four money columns: estimated revenue and cost from the charge sheet, actual
revenue and cost recomputed from posted documents.

`ShipmentStatusHistory` records every lifecycle transition with its from and to
status. `ShipmentDocuments` versions each document type per shipment, so a
replacement bill of lading becomes version 2 rather than overwriting version 1.

### Financial documents

```
VendorPurchaseOrders ──< VendorPurchaseOrderItems
        │
        ↓ (must be approved before invoicing)
VendorInvoices ──< VendorInvoiceItems
        │
        └──< VendorPaymentAllocations >── VendorPayments

AgentInvoices ──< AgentInvoiceItems
        └──< AgentPaymentAllocations >── AgentPayments

FreightInvoices ──< FreightInvoiceItems
        └──< CustomerPaymentAllocations >── CustomerPayments

Expenses ──> ExpenseCategories, Shipments
```

Every payment reaches its invoices through an allocation table. That is what
makes partial settlement, one payment across several invoices, and on-account
balances all representable without special cases.

### Ledger

```
LedgerAccounts (partyType, partyId, currencyCode) ──< LedgerEntries
```

One account per party and currency, holding `debitTotal`, `creditTotal` and
`balance`. `LedgerEntries` is append only. Each row carries the amount in
document currency, the base-currency equivalent, and `balanceAfter`.

## 2. Conventions applied to every table

| Column | Purpose |
|---|---|
| `id` | `NVARCHAR(30)` cuid primary key. Time-ordered, so clustered index inserts stay sequential. |
| `createdAt` / `updatedAt` | `DATETIME2`, `updatedAt` maintained by Prisma. |
| `createdById` / `updatedById` | The acting user, stamped by the repository layer. |
| `deletedAt` / `deletedById` | Soft delete. Repositories add `deletedAt: null` to every query unless `withDeleted` is passed. |

Join and ledger tables omit `updatedAt`/`deletedAt` where a row is immutable by
design.

## 3. Indexing

- Unique indexes on every business key: `Shipments.shipmentNo`,
  `FreightInvoices.invoiceNo`, `Customers.code`, and so on.
- Composite indexes on the filters the list screens actually use, for example
  `IX_Shipments_Status_DeletedAt` and `IX_VendorInvoices_Vendor_Status`.
- Foreign key columns are indexed where they are queried, not blindly.
- `IX_LedgerEntries_Account_Date` supports the statement query, which is the
  heaviest read in the system.

## 4. Referential integrity

SQL Server refuses multiple cascade paths, and this schema has several (a
shipment reaches `Users` through both `Customers` and `Vendors`). The rule
applied is therefore:

- **Owned children cascade**: invoice lines, containers, status history.
- **Everything else is `NoAction`**, with removal handled by soft delete and
  guarded in the service layer, which produces a readable error instead of a
  foreign key violation.

## 5. What is not in the schema

- **No status enums**, because Prisma does not support them on SQL Server.
  Allowed values live in `src/types/enums.ts` and are enforced by Zod. Add
  `CHECK` constraints in a migration if you want them enforced by the database.
- **No stored balance on parties.** A customer's outstanding figure is derived
  from open invoices or from the ledger account, never held as a mutable column
  that could drift.
