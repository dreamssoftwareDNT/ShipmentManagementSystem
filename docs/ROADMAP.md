# Development roadmap

## Delivered

**Foundation**
Prisma schema for 33 tables, environment validation, typed error hierarchy,
Decimal money maths, unit of work, gap-free document numbering, generic
repository with soft delete and pagination.

**Access control**
Custom session auth with bcrypt and signed tokens, revocable server-side
sessions, failed-attempt lockout, forgot and reset password, seven roles over a
generated permission catalogue, edge middleware, page and API guards, audit log.

**Operations**
Customers with history and summary. Shipments with the eight-stage lifecycle,
forward-only transitions, containers, charge sheet, tracking feed, document
library with MIME and magic-number checks, estimated and realised margin.

**Procurement**
Vendors and vendor types. Clearing agents. Purchase orders with an approval
workflow and a separation-of-duty rule. Vendor and agent invoices that post to
the ledger on creation. Payments with multi-invoice allocation.

**Receivables**
Freight invoices with a draft-then-issue flow. Customer receipts with
allocation. Overdue tracking.

**Finance**
Append-only party ledgers with reversal entries and running balance. Expenses
with approval. Money changers and currency exchange. Effective-dated rates.
Six reports with CSV export. Dashboard with metrics and charts.

## Next

**Phase 1 — Operational hardening**
- Automated tests: unit tests for `InvoiceCalculator`, `PaymentAllocator` and
  the lifecycle state machine; integration tests for posting and reversal.
- SQL `CHECK` constraints on status columns to match the TypeScript unions.
- Migration baseline (`prisma migrate dev`) instead of `db push` before the
  first production deploy.
- Rate limiting on the login and password reset endpoints at the edge.

**Phase 2 — Financial depth**
- Credit and debit notes as first-class documents.
- Automatic realised and unrealised foreign exchange gain and loss on
  settlement, using the rate difference between invoice and payment date.
- Ageing buckets (30/60/90) on the outstanding reports.
- Statement of account as a printable PDF.
- Credit limit enforcement when issuing an invoice.

**Phase 3 — Operational reach**
- Carrier tracking integration to populate `ShipmentTrackingEvents` automatically.
- Customer portal with read-only shipment tracking and invoice download.
- Email delivery for password reset, invoice issue and arrival notices.
- Quotation module feeding approved rates into the shipment charge sheet.

**Phase 4 — Scale**
- Object storage for documents in place of the local filesystem.
- Read replica routing for reports and the dashboard.
- Background job runner for scheduled overdue recalculation and rate refresh.
- Multi-branch support, with branch scoping added to the repository base class.

## Sequencing note

Phase 1 comes first because the ledger is already the system of record. Tests
and database-level constraints protect the correctness that the service layer
currently guarantees on its own. Everything in phases 2 to 4 assumes that safety
net exists.
