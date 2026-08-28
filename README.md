# PQ COMMAND

PQ COMMAND is the internal operating system for PQ Real Estate company-let operations. This initial repository is production-minded by default: strict TypeScript, App Router, explicit server boundaries, environment validation, a health-check route, and no fake integrations or embedded secrets.

## Architecture

The repository is organized around thin delivery layers and explicit domain/server boundaries:

- `src/app`: Next.js App Router routes and route handlers.
- `src/components/ui`: low-level reusable UI primitives.
- `src/components/layout`: layout composition for pages and shells.
- `src/domain`: domain models and architecture metadata.
- `src/server/services`: server-side orchestration services.
- `src/db`: database configuration and migration entrypoint.
- `src/lib`: shared utilities including environment validation.
- `src/jobs`: background job registration surface.
- `src/integrations`: external service registration surface.
- `src/ai`: AI provider registration surface.
- `tests`: Node-based test coverage.
- `docs`: repository documentation.

More detail is available in `docs/architecture.md`.

## Requirements

- Node.js 20+
- npm 10+

If Node is installed but not on `PATH` in PowerShell, add `C:\Program Files\nodejs` to `PATH` before running the commands below.

## Environment

Copy `.env.example` to `.env.local` and fill only the values you actually need. All integration and AI settings are optional by design.

Supported variables:

- `APP_NAME`
- `APP_ENV`
- `AUTH_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_ID`
- `AUTH_MICROSOFT_ENTRA_ID_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_ISSUER`
- `AUTH_ADMIN_EMAILS`
- `AUTH_MANAGER_EMAILS`
- `DATABASE_URL`
- `STORAGE_ROOT`
- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `SLACK_WEBHOOK_URL`

Environment values are validated in `src/lib/env.ts` during server startup.

## Authentication

Authentication is implemented with Auth.js and Microsoft Entra ID. PQ does not store passwords; identity verification is delegated to the provider.

- Internal routes are protected by middleware and server-side guards.
- Role-based authorization helpers live under `src/server/auth`.
- Admin and manager roles are resolved from the configured email allowlists.
- If the auth environment variables are not configured, sign-in stays unavailable and no production users are connected.

## Scripts

```bash
npm run dev
npm run bot
npm run local:always-on
npm run local:register-startup
npm run lint
npm run typecheck
npm run test
npm run build
npm run format
npm run format:check
npm run db:generate
npm run db:migrate
```

`npm run db:generate` creates SQL migrations from the Drizzle schema. `npm run db:migrate` applies committed migrations when `DATABASE_URL` is configured and otherwise exits cleanly without touching a database.

For an always-on local Windows setup:

- `npm run bot` starts the constant sourcing bot loop.
- `npm run local:always-on` launches both the web server and the bot in restart loops.
- `npm run local:register-startup` registers a Windows logon task so the local stack restarts automatically after reboot or sign-in.

## Database

PostgreSQL persistence is implemented with Drizzle ORM.

- Schema definitions live in `src/db/schema.ts`.
- Typed models live in `src/db/models.ts`.
- Repositories live in `src/server/repositories`.
- Database-oriented services live in `src/server/services`.
- Generated SQL migrations live in `drizzle/`.
- Private uploaded files are stored behind a storage adapter and served through protected app routes.

Additional details are in `docs/database.md`.

The day-to-day operating model, commercial north star, and agent workflow order are documented in `docs/OPERATING_MODEL.md`.

## Mobile Access

For iPhone Safari on the same Wi-Fi network as the host machine, use the host machine LAN URL instead of `localhost`.

Example on the current laptop network:

- `http://192.168.1.188:3001`

Important:

- `localhost` only works on the same device that runs the app.
- LAN access works only while the host machine is on, awake, and on the same network.
- For access from any phone on any network, deploy the app and worker using the hosted process model in `docs/HOSTED_DEPLOYMENT.md`.

## Health Check

The repository exposes `GET /api/health`. The route reports validated runtime state and whether optional boundaries such as database, integrations, jobs, and AI providers are configured.

## Continuous Operation

PQ COMMAND is intended to run continuously. The constant sourcing bot is responsible for keeping recurring discovery, research, scoring, inbox sync, matching, and shortage jobs flowing without requiring a manual morning start.

## Verification

The baseline verification set for this repo is:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
