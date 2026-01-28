# Compliance Checklist (Draft)

## Factur-X / EN16931
- [ ] Required header fields present (invoice number, issue date, currency)
- [ ] Buyer/Seller party identification
- [ ] Line items with tax rates and amounts
- [ ] Total amounts reconciled
- [ ] PDF/A-3 validation via veraPDF
- [ ] Embedded XML with AFRelationship=Data

## PDP Integration
- [ ] Submission idempotency enforced
- [ ] Status mapping documented
- [ ] Error handling and retries configured

## Audit & Traceability
- [ ] Correlation IDs logged and persisted
- [ ] Audit log entries for each step
- [ ] Metrics for webhook and job outcomes

## Security
- [ ] Webhook signature verification
- [ ] Secrets encrypted at rest
- [ ] Metrics endpoint protected
