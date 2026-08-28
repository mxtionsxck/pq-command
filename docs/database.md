# Database Foundation

PQ COMMAND uses PostgreSQL with Drizzle ORM as the typed persistence layer.

## Principles

- Drizzle schema definitions are the source of truth for tables, indexes, and enum-backed statuses.
- Migrations are committed to `drizzle/` and applied by `npm run db:migrate` when `DATABASE_URL` is configured.
- Application code should use repositories or services under `src/server`, not inline SQL in route or UI code.
- IDs are application-generated ULID-based strings with table-specific prefixes for audit readability.
- No production seed data is included.

## Coverage

The initial schema includes:

- users
- companies
- contacts
- properties
- property_media
- documents
- requirements
- leads
- signals
- sources
- outreach_campaigns
- outreach_messages
- conversations
- messages
- matches
- viewings
- deals
- tasks
- notifications
- objectives
- audit_events
- suppression_list
- job_runs
