# Incident Runbook

## Immediate Triage

1. Classify severity.
2. If outbound risk exists, enable kill switch and disable Level 3 autonomy.
3. Pause affected workers.
4. Preserve audit data and logs.
5. Identify last good deployment and migration state.

## Common Incidents

### Outbound compliance incident
- Enable kill switch
- Pause outreach-related workers
- Check suppression, approval mode, directness, and campaign status history
- Review audit events and send-attempt policy snapshots

### Auth or RBAC incident
- Disable compromised local admin credentials at environment level
- Review recent admin user API access and audit events
- Confirm route protection still blocks unauthorized access

### Data integrity incident
- Stop affected workers
- Identify faulty migration or mutation path
- Restore from verified backup only if repair-in-place is unsafe

### Provider outage
- Disable affected connector/source
- Pause dependent jobs
- Switch operations to manual review until provider health recovers

## Recovery

1. Apply fix.
2. Re-run focused smoke checks.
3. Resume workers in stages.
4. Keep autonomy disabled until confidence is restored.
5. Document root cause and preventive action.
