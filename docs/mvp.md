# MVP Checklist (SUPER PDP)

This page is a non-dev oriented checklist for getting a first MVP live end-to-end:
CrocoClick (GHL) invoice → CrocoTax → Factur‑X → SUPER PDP → status + artifacts available.

## MVP definition (what “done” means)
- 1 pilot tenant is configured and isolated.
- Invoice webhooks are received reliably (no duplicates, no missing events).
- Factur‑X is generated for each invoice and stored.
- SUPER PDP accepts or rejects the submission and CrocoTax records the full status trail.
- A user can retrieve the latest PDF/XML for an invoice and see the current delivery status.

## Inputs to collect (business/ops)
- SUPER PDP sandbox access:
  - API base URL (sandbox)
  - API key(s) and how they are rotated
  - Documentation for: submit invoice, fetch status, error codes, idempotency rules
- GoHighLevel (CrocoClick) access for the pilot tenant:
  - Webhook setup (events + signing secret)
  - API key to fetch invoice details
- A list of 10 real (or realistic) invoices for the pilot, including edge cases (VAT, discounts, credit note if in scope).

## MVP environment setup (ops)
- Run in a staging-like environment (not a laptop):
  - Managed Postgres with backups enabled
  - Object storage (S3/MinIO compatible) for artifacts
  - Secrets managed outside git (.env is local-only)
- Enable basic observability:
  - Logs centralized (correlationId searchable)
  - Metrics endpoint protected (`METRICS_TOKEN`)

## MVP technical steps (dev)
- Configure CrocoTax with the pilot tenant and secrets.
- Implement SUPER PDP submission/status mapping using their API documentation.
- Configure CrocoTax PDP settings:
  - `PDP_PROVIDER=superpdp`
  - `PDP_API_BASE=https://api.superpdp.tech`
  - `PDP_API_KEY=...` (SUPER PDP OAuth2 access token)
  - `PDP_ARTIFACT_MODE=base64` (required for SUPER PDP file upload)
- Run an end-to-end smoke:
  - Create/update invoice in GHL → webhook received → pipeline completes → status becomes final.
- Run compliance validation for generated Factur‑X artifacts (see `docs/compliance-checklist.md`).

## Acceptance criteria (go/no-go)
- Functional
  - ≥ 95% of pilot invoices are accepted end-to-end on first try (excluding known invalid test cases).
  - All failures are explained by a visible error reason (audit log + PDP raw status/error).
- Compliance (minimum)
  - PDF/A-3 validation passes for pilot invoices (where enabled).
  - Required EN16931/Factur‑X header fields are present.
- Ops
  - There is a documented rollback: disable PDP submission (or switch to mock) without losing invoices.

## Rollback (MVP-safe)
- Stop the worker first (prevents new submissions).
- Keep API running to serve invoice status/artifacts.
- Preserve DB + artifacts (no destructive migrations).
