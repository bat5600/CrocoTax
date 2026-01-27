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
- Default API port is `3000` (see `PORT` in `.env`).
- Webhook secret defaults to `demo-secret` for the seeded tenant.
- Storage defaults to filesystem (`./storage`).
- Factur-X generation is stubbed by default (`FACTURX_MODE=stub`).
- For PDF/A-3 Factur-X, set `FACTURX_MODE=cli` and install `ghostscript` + `qpdf`, then set `PDFA_ICC_PROFILE` to an sRGB `.icc` file.
- Optional PDF/A validation: install `verapdf` and run `VERAPDF_VALIDATE=1 npm run facturx:smoke` (set `VERAPDF_BIN` if not on PATH).
- For PDFBox attachment support, set `PDFBOX_JAR` to the local `pdfbox-app-3.x.x.jar` path (used to set AFRelationship and OutputIntent).

## Directory Overview
- `apps/api`: webhook ingest, idempotency, enqueue
- `apps/worker`: job processing pipeline
- `packages/*`: shared modules (db, queue, storage, facturx, etc.)
- `migrations/`: SQL schema
- `scripts/`: migrate/seed utilities
- `tests/`: integration + unit tests
