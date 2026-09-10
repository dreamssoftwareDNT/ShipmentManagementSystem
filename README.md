# ImportMS — Freight Forwarding ERP

Shipment operations, procurement, receivables and party ledgers for a freight
forwarding business. Next.js App Router, TypeScript, Prisma and Microsoft SQL
Server.

## Getting started

```bash
npm install
cp .env.example .env      # then set DATABASE_URL and AUTH_SECRET
npm run db:push           # create the schema
npm run db:seed           # roles, permissions, users, reference data
npm run dev
```

Open http://localhost:3000 and sign in with `admin@importms.local` and the
password printed by the seed. Every seeded account shares that password; change
them before the system holds anything real.

### Environment

`.env.example` documents every variable. The two that must be set before the app
will start:

```
DATABASE_URL="sqlserver://HOST:1433;database=ImportMS;user=USER;password=PASS;encrypt=true;trustServerCertificate=true"
AUTH_SECRET=<32 or more random characters>
```

`AUTH_SECRET` signs session tokens. Changing it signs everyone out.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Generate the Prisma client and build for production |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:push` | Push the schema without a migration history |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Seed roles, permissions, users and reference data |
| `npm run db:studio` | Prisma Studio |

## Project structure

```
prisma/          Schema and seed
src/
  app/           Routes: (auth) public, (app) authenticated, api handlers
  components/    Design system, data grid, form building blocks
  features/      Client UI slices, one folder per business area
  modules/       Module manifests: route, icon, group, required permission
  services/      Business rules, transactions, ledger posting
  repositories/  Prisma data access with soft delete and pagination
  schemas/       Zod DTOs shared by the API and the forms
  database/      Prisma client, unit of work, document numbering
  lib/           Errors, money, security, route wrapper, API client
  config/        Environment, permission catalogue, role matrix
  types/         Status unions and shared contracts
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — layering, request lifecycle, ledger design, known constraints
- [Database](docs/DATABASE.md) — entity groups, conventions, indexing, integrity rules
- [Roadmap](docs/ROADMAP.md) — what is built and what comes next

## Roles

| Role | Scope |
|---|---|
| Administrator | Everything, including users and roles |
| Operations Manager | Shipments, partners, purchase orders, read-only finance |
| Finance Manager | Receivables, payables, ledgers, financial approvals |
| Accountant | Records invoices, payments and expenses; no approval authority |
| Shipment Manager | Shipment lifecycle, documents and tracking |
| Vendor Manager | Vendors, clearing agents, procurement records |
| Viewer | Read-only across operational and financial data |

The matrix lives in `src/config/permissions.ts` and is written to the database by
the seed. Editing it there and re-running the seed is what changes policy.

## Two things worth knowing before you extend it

**The ledger is append only.** Invoices and payments never mutate a balance
column. They post entries, and corrections post mirrored reversals. If you add a
financial document, post it through `LedgerService` inside the same transaction
that writes the document.

**Prisma has no enums on SQL Server.** Status values are `NVARCHAR` columns
backed by const unions in `src/types/enums.ts` and enforced by Zod at the API
boundary. Add a new status in that file first.
