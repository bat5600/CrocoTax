# CrocoTax E-Invoicing Layer - Tracking

## Non-Dev Summary (TL;DR)
CrocoTax is a back-office service that helps CrocoClick invoices become compatible with **French e-invoicing** requirements.

What it does (in plain terms):
- When an invoice is created/updated in CrocoClick (via GoHighLevel), we receive a notification ("webhook") and fetch the full invoice details.
- We convert the invoice into a standard internal format (based on EN16931), then generate a compliant **Factur-X** invoice file.
- We send it to the French e-invoicing ecosystem **through an accredited provider (PA/PDP)** and keep the status in sync back into CrocoClick.

Important boundaries:
- CrocoClick/CrocoTax is **not** a PA/PDP and does **not** connect directly to the government platform (PPF).
- We focus on reliability and traceability: multi-tenant isolation, no duplicate submissions (idempotency), and an audit trail.

How to use this document:
- **Milestones** = what we plan to deliver next.
- **Decision Log** = key architectural choices and why.
- **Progress Log** = what changed, when (add-only history).

## Objective
Build a compliance-critical French e-invoicing layer for CrocoClick (GoHighLevel whitelabel) as a **"solution compatible"**:
- Consume GHL invoice webhooks
- Fetch full invoice details via GHL Invoice API
- Map to a canonical invoice model (EN16931-aligned)
- Generate Factur-X (PDF/A-3 + embedded CII XML)
- Transmit via an accredited PA/PDP API (CrocoClick is **not** a PA/PDP; no direct PPF integration)
- Sync statuses back into GHL

Non-functional requirements: multi-tenant, auditable, idempotent, secure, observable.

## Scope (MVP Skeleton)
- Repo scaffold + module boundaries
- Database schema (tenants, secrets placeholders, invoices, artifacts, submissions, jobs, idempotency, audit_log)
- DB-backed job queue + worker stubs for the 5 core workflow steps
- Fastify API with `/health` + `/webhooks/ghl` endpoint
- Correlation ID propagation + audit event logging
- Local dev stack (Postgres + MinIO) via docker-compose
- Tests: unit test framework + one integration test covering webhook -> enqueue -> worker -> audit

## Out of Scope (for now)
- Real Factur-X generation implementation
- Real PA/PDP provider integration
- Full GHL API implementation (only stubs)
- UI, admin portal, tenant management UI
- Certified archival / long-term legal storage

## Milestones
- [ ] M0 - Repo skeleton runnable locally (install, compose up, migrate, dev, test)
- [ ] M1 - Canonical mapping with fixtures + validation
- [ ] M2 - Factur-X generation (PDF/A-3 + embedded CII XML) + storage
- [ ] M3 - PDP submission + status sync + retries + reconciliation
- [ ] M4 - Hardening: security, metrics/tracing, tenancy isolation checks, ops docs

## Architecture Snapshot (Current)
- API (`apps/api`): webhook ingest + tenant resolution + idempotency + enqueue
- Worker (`apps/worker`): DB queue consumer + handler stubs per job type
- Postgres: source of truth + job queue + idempotency constraints + audit trail
- Object store: planned for artifacts (MinIO in dev; client stubbed)

## Decision Log (Add-only)
- 2026-01-26: Chose Postgres-backed job queue (`jobs` table) to avoid Redis dependency for MVP skeleton.
- 2026-01-26: Added `schema_migrations` tracking to make migrations idempotent across reruns.
- 2026-01-26: Integration tests use `testcontainers` with `GenericContainer` for Postgres.
- 2026-01-26: Default storage mode is filesystem for local dev; MinIO/S3 is supported via config.
- 2026-01-26: Secrets encryption uses AES-256-GCM with `TENANT_SECRET_KEY` (fallback to plaintext for dev).
- 2026-01-26: Factur-X generation starts with a stub PDF + CII XML for MVP pipeline validation.

## Progress Log (Add-only)
Use one entry per meaningful change. Keep entries short, factual, and actionable.

### 2026-01-26
- **Enforced skeleton scaffold shipped**
  - Added monorepo structure: `apps/api`, `apps/worker`, `packages/*`, `migrations/`, `scripts/`, `fixtures/`, `tests/`.
  - Implemented schema + constraints: tenants, tenant_secrets, invoices, artifacts, pdp_submissions, jobs, idempotency_keys, audit_log.
  - Implemented DB queue + worker handlers (stubs) + Fastify endpoints + audit logging + correlation propagation.
  - Added local dev: docker-compose (Postgres + MinIO), migrate/seed scripts.
  - Added integration test: webhook -> enqueue -> worker -> audit.

### 2026-01-26
- **Stability improvements**
  - Added minimal `.env` loader (no external dependency) for scripts/apps.
  - Added DB readiness wait + retries for migrations/seed to reduce transient `ECONNRESET`.
  - Wrapped initial migration in transaction + added `schema_migrations` table to avoid reapplying migrations.

### 2026-01-26
- **Documentation**
  - Added a non-dev TL;DR section at the top of `TRACKING.md`.

### 2026-01-26
- **Pipeline foundation (M1–M3)**
  - Added canonical invoice schema + GHL → Canonical mapping with validation.
  - Implemented Factur-X stub generation (PDF placeholder + CII XML) with hashes.
  - Added storage client (filesystem default, MinIO/S3 optional).
  - Implemented PDP clients (mock + HTTP) and wired submission/status sync into worker.
  - Added DB helpers for invoices/artifacts/submissions; expanded invoice statuses.

### 2026-01-26
- **Security & config**
  - Added AES-256-GCM secret encryption helpers and tenant secret retrieval.
  - Expanded `.env.example` with storage/facturx/pdp/secret settings.
  - Updated tests to use filesystem storage and mock PDP to avoid external dependencies.
  - Refreshed GHL fixture data with invoice number and issue date fields.

## Current Risks / Notes
- `testcontainers` may require pulling `testcontainers/ryuk` once; with poor network, use `TESTCONTAINERS_RYUK_DISABLED=true`.
- Docker daemon permissions vary by environment; ensure Docker Desktop WSL integration is enabled.

### 2026-01-27
- **What changed**: Added `README.md` with local setup, dev, and test instructions.
- **Why**: Make M0 runnable and document the expected local workflow.
- **Impact/Risk**: Documentation only; no runtime behavior changes.
- **Verification**: Not run (docs update).

- **What changed**: Made `migrations/0001_init.sql` idempotent with `IF NOT EXISTS` for tables/indexes.
- **Why**: Allow `npm run migrate` to succeed when schema exists but `schema_migrations` is empty (M0 repeatability).
- **Impact/Risk**: Schema creation becomes re-runnable; no runtime behavior changes expected.
- **Verification**: `docker compose up -d`, `npm run migrate`, `npm run seed`, `npm test`.

- **What changed**: Expanded GHL mapping fixtures and added unit tests; normalized currency and clamped negative line values in mapper.
- **Why**: Progress M1 by covering alternate inputs and validation edge cases.
- **Impact/Risk**: Mapper now normalizes currency and prevents invalid line values; low risk to behavior.
- **Verification**: `npx vitest run tests/unit/ghl-mapper.test.ts`.

- **What changed**: Tightened canonical schema to require YYYY-MM-DD issue dates and normalized date/currency in GHL mapper; updated unit expectations.
- **Why**: Improve M1 validation and ensure canonical dates are compliant.
- **Impact/Risk**: Canonical issueDate now normalized to date-only; downstream consumers should expect YYYY-MM-DD.
- **Verification**: `npx vitest run tests/unit/ghl-mapper.test.ts`.

- **What changed**: Added total-mismatch fixture/test and adjusted GHL mapper to reconcile totals using line sums (including tax). Updated unit expectations.
- **Why**: Improve M1 validation when reported totals disagree with line items.
- **Impact/Risk**: Canonical `totalAmount` may now be derived from line totals if mismatch > 0.01.
- **Verification**: `npx vitest run tests/unit/ghl-mapper.test.ts`.

- **What changed**: Added tolerance fixture/test for total rounding and adjusted total reconciliation to tolerate floating-point drift.
- **Why**: Ensure M1 mapping does not override reported totals for minor rounding differences.
- **Impact/Risk**: Totals within ~0.01 now preserve reported amount; reduced false corrections.
- **Verification**: `npx vitest run tests/unit/ghl-mapper.test.ts`.

- **What changed**: Added extensive M1 fixtures (invalid country/currency, missing parties, tax range, mixed tax, discount, credit note) and expanded mapper tests. Normalized currency/country, clamped tax rates, applied discounts in total reconciliation.
- **Why**: Cover validation edge cases and improve canonical mapping robustness for M1.
- **Impact/Risk**: Canonical totals can now consider discounts; tax rates outside [0,1] become 0; invalid country/currency default to FR/EUR.
- **Verification**: `npx vitest run tests/unit/ghl-mapper.test.ts`.

- **What changed**: Added canonical schema refinements (currency/country format, tax rate max, total consistency with discounts) and new canonical schema unit tests; mapper now emits optional `discountTotal`.
- **Why**: Finalize M1 validation rules and ensure canonical totals are consistent with line items.
- **Impact/Risk**: Canonical validation is stricter; malformed canonical payloads now fail fast.
- **Verification**: `npx vitest run tests/unit/ghl-mapper.test.ts tests/unit/canonical-schema.test.ts`.

- **What changed**: Added CLI-based Factur-X generator using Ghostscript PDF/A-3 conversion and qpdf XML attachment; added `PDFA_ICC_PROFILE` env and README guidance.
- **Why**: Implement M2 real Factur-X generation pipeline beyond the stub.
- **Impact/Risk**: Requires external binaries (`gs`, `qpdf`) and an sRGB ICC profile; generation will fail fast if missing.
- **Verification**: Not run (missing system dependencies in this environment).
