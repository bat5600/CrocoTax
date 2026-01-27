# M3 Plan (PDP Integration)

## Goals
- Replace mock PDP with a real integration surface: auth, submission, status polling, retries, and reconciliation hooks.
- Ensure idempotent submissions and reliable status sync back to GHL.

## Scope
1. Provider client interface finalization (request/response schemas, error mapping).
2. Auth strategy (API key, OAuth, or signed JWT) with rotation/tenant secrets.
3. Submission flow: submit invoice + artifacts, parse response, persist.
4. Status polling: schedule/check status, map provider states to internal statuses.
5. Retry policy: exponential backoff, idempotency keys, failure classification.
6. Reconciliation job: re-sync missing/failed statuses.
7. Observability: audit events + metrics/logging.
8. Test coverage: unit tests + integration test with provider mock.
