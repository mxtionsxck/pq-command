# Architecture

PQ COMMAND uses a thin-route, explicit-boundary architecture designed to scale without collapsing application, domain, and operational concerns into a single layer.

## Structure

- `src/app`: HTTP and UI delivery through the Next.js App Router.
- `src/components/ui`: visual primitives with no business knowledge.
- `src/components/layout`: composition utilities for shells and page structure.
- `src/domain`: domain-level types and repository metadata.
- `src/server/services`: orchestration and response assembly for server flows.
- `src/db`: database bootstrapping and migration entrypoints.
- `src/lib`: cross-cutting utilities such as environment parsing.
- `src/jobs`: background processing registry.
- `src/integrations`: external system registry.
- `src/ai`: AI provider registry.

## Rules

- App routes should coordinate, not implement domain logic.
- Domain modules should stay framework-agnostic.
- Server services may compose domain, db, integrations, jobs, and ai boundaries.
- Optional integrations must remain unconfigured until real credentials and implementation choices are made.
- Secrets live in environment variables only.
