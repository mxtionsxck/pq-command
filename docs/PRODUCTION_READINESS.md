# Production Readiness

Date: 2026-08-28

## Status

Not production-ready yet. No unresolved code-level critical blocker remains in the repository, but release blockers remain because several production dependencies and operational controls cannot be verified from this environment.

## Checklist

Completed in repo:
- Environment variables represented in `.env.example`
- Production database migrations present through `0013_wooden_pilot_feedback.sql`
- Render blueprint and container artifacts prepared for web + worker + database deployment
- Secure headers configured
- Outbound kill switch path implemented and previously tested in automated tests
- Suppression path implemented and tested
- Audit path implemented and tested
- RBAC path implemented and tested
- Accessibility baseline improved for key internal flows
- Large lists paginated
- Images optimized on property media pages
- Pilot mode implemented with persistent feedback capture and daily summary

Still requires environment/operator verification:
- Production database migration tested against production-like database
- Backup procedure executed and restore drill verified
- Storage adapter configured for production object storage
- Real email provider configured and end-to-end outbound/inbound verified
- Approved source connectors configured with live credentials
- AI provider configured with production key rotation policy
- Monitoring configured
- Error alerts configured
- Worker schedules configured in production runtime
- Real PQ pilot data loaded
- Demo/fake fixtures removed from production paths and sample data policy confirmed
- Rollback drill exercised

## Release Blockers

1. Production backup and restore has not been verified.
2. Shared production storage/email/AI provider configuration cannot be confirmed from repository state alone.
3. Monitoring and alert routing are not verifiable from code alone.
4. Real pilot data load and production fixture-removal process are not verifiable from this environment.
5. Current app-level rate limiting is in-memory and should be backed by a shared store for multi-instance deployment.
6. No hosting account or deployed production environment is connected from this machine yet.

## Database Migration Notes

Run in order:
- Existing migrations `0000` through `0013`
- Validate schema after migration on a production-like database before release

## Build/Deploy Process

1. Install dependencies with lockfile.
2. Set required environment variables.
3. Run migrations.
4. Run validation commands:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
   - `npm run build`
5. Verify admin sign-in, kill switch, suppression, and audit flows.
6. Only then promote the release.

## Rollback Plan

1. Disable outbound automation via kill switch and Level 3 autonomy switch.
2. Stop worker execution / pause workers in operations console.
3. Revert application deploy to previous stable artifact.
4. If needed, restore database from verified backup point.
5. Re-run smoke checks: auth, inbox, outreach gating, audit, and core data views.

## Final Blocker List

Release blockers remain. Do not declare this system production-ready until the blockers above are closed.
