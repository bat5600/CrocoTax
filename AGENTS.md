# Agent Instructions (Repo-Enforced)

This repository is compliance-critical. Any agent (human or AI) making changes must keep an auditable trail of intent and progress.

## Mandatory: Update the Tracking Doc on Every Change
After **each meaningful modification** (code, schema, config, scripts, docs), append an entry to:
- `TRACKING.md` -> **Progress Log (Add-only)**

### Entry format (copy/paste)
Add a bullet under the current date (or create a new date section):
- **What changed**: 1-2 lines, concrete (files/modules impacted)
- **Why**: the intent / requirement being satisfied
- **Impact/Risk**: any behavior change, migration implications, rollback notes
- **Verification**: commands run (e.g. `npm test`, `npm run migrate`, manual checks)

### Rules
- Add-only: do not rewrite history; append new entries.
- Use ISO dates: `YYYY-MM-DD`.
- Prefer facts over opinions. Keep it short.

## Optional but Recommended
- If a change affects architecture, add/update `TRACKING.md` -> Decision Log.
- If a change affects dev workflow, update `README` or add a note under `TRACKING.md` -> Current Risks / Notes.

