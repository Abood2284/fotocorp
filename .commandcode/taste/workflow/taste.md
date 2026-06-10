# workflow
- Do not create one-time scripts that persist in the repo. Prefer direct SQL or temporary scripts that are deleted after use. Confidence: 0.85
- Debug and present root cause analysis first, then wait for greenlight before modifying any code. Confidence: 0.90
- Use rollback-only regression tests (seed → test → rollback) for data integrity fixes, not permanent smoke scripts. Confidence: 0.70
- All Neon database operations must target the Development branch, never the production branch. Confidence: 0.85
- When adding new Hono routes, add a smoke check entry to apps/api/scripts/smoke/check-hono-routes.ts covering the method guard (405) for each new route. Confidence: 0.70
- PR documentation must be updated with each implementation: update architecture.md, progress-tracker.md, and api-routing-audit.md when routes/patterns change. Confidence: 0.70
