# Ops Notes

## Logs
- Logs are JSON via pino (`LOG_LEVEL` controls verbosity).

## Metrics
- API exposes `/metrics` (Prometheus text format).
- Counters include webhook totals and worker job totals.

## PDP Reconciliation
- Background reconciliation is scheduled by the worker.
- Configure via `PDP_RECONCILE_INTERVAL_MS`, `PDP_RECONCILE_BATCH`, `PDP_RECONCILE_OLDER_MINUTES`.

## Factur-X
- PDF rendering uses PDFKit; `FACTURX_MODE=stub` generates PDF + XML without PDF/A-3 conversion.
- CLI mode uses Ghostscript + qpdf and optional PDFBox (`PDFBOX_JAR`) for AFRelationship/OutputIntent.
- Use `facturx:smoke` with `VERAPDF_VALIDATE=1` to validate PDF/A-3.
