# CrocoTax E-Invoicing Layer

Compliance-focused service that converts CrocoClick (GoHighLevel) invoices into a canonical EN16931-aligned format, generates Factur-X artifacts, and submits through a PA/PDP provider.

## Quickstart (Local)

### Prerequisites
- Node.js 20+
- Docker + Docker Compose

### Setup
```bash
npm install
cp .env.example .env
```

### Start dependencies
```bash
docker compose up -d
```

### Run migrations + seed demo tenant
```bash
npm run migrate
npm run seed
```

### Run API + worker
```bash
npm run dev
```

### Run tests
```bash
npm test
```

## Useful Notes
- Default API port is `3001` (see `PORT` in `.env`).
- Webhook secret defaults to `demo-secret` for the seeded tenant.
- Storage defaults to filesystem (`./storage`).
- Factur-X rendering uses PDFKit to generate a real invoice PDF.
- `FACTURX_MODE=stub` renders PDF + XML without PDF/A-3 conversion or XML embedding.
- For PDF/A-3 Factur-X with embedded XML, set `FACTURX_MODE=cli` and install `ghostscript` + `qpdf`, then set `PDFA_ICC_PROFILE` to an sRGB `.icc` file.
- Optional PDF/A validation: install `verapdf` and run `VERAPDF_VALIDATE=1 npm run facturx:smoke` (set `VERAPDF_BIN` if not on PATH).
- For PDFBox attachment support, set `PDFBOX_JAR` to the local `pdfbox-app-3.x.x.jar` path (used to set AFRelationship and OutputIntent).
- PDP integration: set `PDP_PROVIDER`, `PDP_API_BASE`, `PDP_API_KEY`. Use `PDP_ARTIFACT_MODE=base64` to send artifact contents or `keys` to send storage keys only. Reconciliation runs on `PDP_RECONCILE_INTERVAL_MS`.
- PDP smoke: set `TENANT_ID` (seed output) and run `npm run pdp:smoke` to exercise webhook -> worker -> PDP.
- Ops notes: see `docs/ops.md`.
- Runbook: see `docs/runbook.md`.
- Compliance checklist: see `docs/compliance-checklist.md`.
- Maintenance: set `ARTIFACT_RETENTION_DAYS` and run `npm run cleanup:artifacts` (add `DRY_RUN=1` to preview deletions).
- Security: set `METRICS_TOKEN` to require `Authorization: Bearer <token>` on `/metrics`. Set `WEBHOOK_RATE_LIMIT` (requests/sec) to throttle webhooks.
- Tenant API: set `TENANT_API_TOKEN` (or `tenants.config.api_token`) to protect `/api/v1/*` endpoints (requires `x-tenant-id` + `Authorization: Bearer ...`).
- Invoice artifacts: download the latest Factur-X via `/api/v1/invoices/:id/artifacts/pdf` and `/api/v1/invoices/:id/artifacts/xml` (tenant-scoped + token-protected).
- Invoice list filters: `/api/v1/invoices?status=ACCEPTED&ghlInvoiceId=...` plus cursor pagination.

## Directory Overview
- `apps/api`: webhook ingest, idempotency, enqueue
- `apps/worker`: job processing pipeline
- `packages/*`: shared modules (db, queue, storage, facturx, etc.)
- `migrations/`: SQL schema
- `scripts/`: migrate/seed utilities
- `tests/`: integration + unit tests
