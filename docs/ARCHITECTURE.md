# System architecture

## 1. Layering

The application is a single Next.js deployment with four strictly ordered rings.
Each ring may only call the one below it.

```
app/            Route handlers, server components, pages          (transport)
  ↓
services/       Business rules, transactions, workflow, posting    (domain)
  ↓
repositories/   Prisma queries, soft-delete scoping, pagination    (persistence)
  ↓
database/       Prisma client, unit of work, number sequences      (infrastructure)
```

Supporting directories cut across the rings rather than sitting inside them:

| Directory | Responsibility |
|---|---|
| `schemas/` | Zod DTOs. Used by the route handler and the browser form, so validation is written once. |
| `config/` | Environment parsing, the permission catalogue, the role matrix. |
| `modules/` | One manifest per business module: route, icon, group, required permission. |
| `features/` | Client UI slices, one folder per business area. |
| `components/` | Design system primitives and the shared data grid. |
| `lib/` | Errors, money maths, security primitives, the route wrapper, the API client. |

### Why this shape

Route handlers contain no business logic. `defineRoute` in
[api-handler.ts](src/lib/http/api-handler.ts) resolves the session, enforces the
permission, validates the DTO and translates errors, so a handler body is a
single call into a service. Adding an endpoint cannot accidentally skip an
authorisation check, because the check is part of the wrapper rather than
something each handler remembers to write.

## 2. Request lifecycle

A write request travels this path:

1. **Middleware** verifies the session cookie's signature at the edge. It proves
   the token is untampered and unexpired. It does not read roles, because the
   edge runtime cannot reach SQL Server.
2. **`defineRoute`** resolves the full user, including roles and permissions,
   and asserts the module and action declared on the route.
3. **Zod** parses the body and query into typed DTOs. Unknown fields are dropped
   and coercions happen once, at the boundary.
4. **The service** opens a transaction through `UnitOfWork`, applies the business
   rules, calls one or more repositories, posts to the ledger, and writes an
   audit entry, all inside that transaction.
5. **The response** is serialised with `Prisma.Decimal` values converted to
   strings, so no money value ever passes through a JavaScript float.

## 3. Transactions and the unit of work

Repositories accept an optional client. When a service passes its transaction
client down, every repository call joins the same transaction:

```ts
return UnitOfWork.run(async (tx) => {
  const vendor = await vendorRepository.requireById(input.vendorId, {}, tx);
  const invoice = await tx.vendorInvoice.create({ ... });
  await ledgerService.post({ ... }, tx);
  await shipmentService.recalculateActuals(input.shipmentId, tx);
  await this.writeAudit(context, { ... }, tx);
  return invoice.id;
});
```

If the ledger posting fails, the invoice is rolled back with it. The register and
the statement cannot disagree.

## 4. The ledger

A single append-only `LedgerEntry` table serves customers, vendors, clearing
agents and money changers, with `LedgerAccount` holding the running balance per
party and currency.

- **Nothing is ever edited or deleted.** A cancelled invoice writes mirrored
  reversal rows, so the statement shows both the original and the correction.
- **Balance convention is `debit − credit`.** An invoice debits the party, a
  settlement credits it. A positive balance therefore means "still outstanding"
  for both receivables and payables, which is what an operator expects to read
  on a party statement.
- **`balanceAfter` is written at post time** while the account row is locked
  inside the transaction, so each entry records the true balance at that moment.

Choosing one polymorphic ledger over four parallel tables means the posting
engine, reversal logic and statement query exist once.

## 5. Money

Every monetary column is `DECIMAL(18,4)` in SQL Server and `Prisma.Decimal` in
code. Rates are `DECIMAL(18,8)`. `src/lib/money.ts` owns rounding, line
arithmetic and base-currency conversion; `InvoiceCalculator` owns document
totals. The browser computes totals only as a live preview. The server always
recomputes them from the submitted quantities and rates, so a tampered payload
cannot change what is stored.

## 6. Authorisation

Permissions are `MODULE:ACTION` pairs generated from `MODULE_ACTIONS` in
[permissions.ts](src/config/permissions.ts). `ROLE_PERMISSION_MATRIX` maps the
seven roles onto those codes, and the seed writes the matrix into the database.

The same catalogue drives three things, so they cannot drift apart:

- The `AccessControl` assertion on every route.
- The sidebar, which only lists modules the user can read.
- The role matrix screen, which shows the policy to administrators.

Page-level guards redirect; API-level guards throw a 403. Administrators bypass
the permission set by role, which keeps the "last administrator" rule meaningful.

## 7. Known constraints

- **Prisma does not support enums on the SQL Server provider.** Status columns
  are `NVARCHAR` and the allowed values live in `src/types/enums.ts`, enforced at
  the Zod boundary. If you want database-level enforcement, add `CHECK`
  constraints in a migration.
- **SQL Server rejects multiple cascade paths.** Business relations use
  `onDelete: NoAction`; only owned child rows (invoice lines, containers)
  cascade. Records are soft deleted rather than removed.
- **Uploads are written to the local filesystem** under `UPLOAD_ROOT`. For a
  multi-instance deployment, replace `DocumentService`'s read and write calls
  with an object store; nothing above that class needs to change.
