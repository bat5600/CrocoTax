# Runbook (Production Readiness)

## Environments
- **Local**: Docker compose for Postgres + MinIO. File storage by default.
- **Staging/Prod**: Managed Postgres + S3-compatible object store. Secrets via environment variables or vault.

## Deploy checklist
1. Apply migrations: `npm run migrate`
2. Verify connectivity (DB + object store).
3. Start API + worker.
4. Validate webhook signature flow.
5. Run `npm run facturx:smoke` (with PDF/A validation enabled in staging).

## Rollback
- Roll back app version first.
- Schema changes are additive; avoid destructive migrations.

## Backups
- Postgres: daily snapshot + PITR.
- Object store: versioning enabled + lifecycle retention.

## Incident response
- Check `/health` and `/metrics`.
- Inspect failed jobs in `jobs` table.
- Review `audit_log` for correlationId.

## Secrets rotation
- Rotate `TENANT_SECRET_KEY`, PDP keys, GHL keys with a staged deploy.
- Re-encrypt tenant secrets if required.

## Data retention
- Configure artifact retention and run cleanup (see `scripts/cleanup-artifacts.ts`).
