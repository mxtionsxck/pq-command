# Admin Runbook

## Core Responsibilities

- Manage users and roles
- Control worker pause/resume and concurrency
- Control global Level 3 autonomy switch
- Monitor audit trail and operational failures
- Maintain source approval governance

## Before Enabling Higher Autonomy

1. Confirm suppression and kill switch behavior.
2. Confirm connector health is green.
3. Confirm approved source permissions are current.
4. Confirm feedback volume is being reviewed.
5. Confirm monitoring and alerts are active.

## Daily Admin Checks

1. Review operations console for failed/dead-letter runs.
2. Review audit events for sensitive mutations.
3. Review pilot feedback trends.
4. Confirm outbound controls remain effective.
5. Confirm no unauthorized role changes occurred.
6. Confirm the constant sourcing bot is running and queue depth is moving.

## Emergency Controls

Use immediately when needed:
- Pause worker(s) in Operations
- Enable outbound kill switch
- Disable global Level 3 autonomy
- Revoke or disable bad source connectors

## Always-On Local Runtime

- `npm run bot`: runs the recurring sourcing bot loop.
- `npm run local:always-on`: starts the web server and bot in restart loops.
- `npm run local:register-startup`: registers a Windows startup task for the current user.

When running locally for long periods, prefer the startup task over an editor-owned terminal session.

## Release Gate

Do not approve go-live until:
- Backup/restore is proven
- Monitoring and alerts are verified
- Live provider credentials are configured
- Migrations have been exercised on production-like data
- No critical blockers remain
