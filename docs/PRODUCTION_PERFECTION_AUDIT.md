# PQ Command Production Perfection Audit

Date: 2026-08-30
Branch baseline: main

## 1) Current Architecture (Verified)
- Next.js app with server-rendered internal operations routes in src/app/(internal)/internal.
- Role-aware auth with local admin credentials and optional Microsoft provider in src/auth.ts.
- Persistent data model with Drizzle + Postgres in src/db/schema.ts and repositories in src/server/repositories.
- Background automation worker in src/jobs/continuous-runner.ts with job orchestration in src/server/services/background-job-infrastructure-service.ts.
- Render split deployment (web + worker + postgres) in render.yaml.
- Health endpoint and system snapshot in src/app/api/health and src/server/services/health-service.ts.

## 2) What Is Already Operational
- Core business modules exist as real routes: leads, demand room, outreach, inbox, viewings, deals, command centre, acquisition, analytics.
- Evidence-aware lead repository and directness workflows exist in server repositories/services.
- Queue visibility and worker health are surfaced in command centre and admin operations.
- Authentication and permissions gates are enforced server-side.

## 3) Gaps To Reach "Monday-Morning Production Excellence"

### A. UX / Workflow clarity (High)
- Historically, root page was design-system-first and not operationally obvious.
- Need consistent "start here" guidance and reduced cognitive load across all major modules.
- Need persistent global navigation patterns (desktop + mobile) to reduce route hopping friction.

### B. Command-centre KPI completeness (High)
- Command-centre currently emphasizes flow metrics (qualified supply, demand, hot replies, queue depth).
- Missing explicit top-row commercial KPIs requested by business playbook (completed this week, pipeline value, completed revenue, rent control highlights).

### C. Integrations status transparency (High)
- Integration wiring exists, but user-facing status should be unified in a single configuration/health panel with clear states:
  - CONNECTED
  - CONFIGURATION REQUIRED
  - FAILED
  - NOT ENABLED

### D. Outreach channel readiness (High)
- Current architecture supports outreach lifecycle concepts, but email/whatsapp channel readiness and governance surfaces need tightening for operator confidence.

### E. Rent and tenancy centre depth (Medium-High)
- Deal and workflow modules exist, but dedicated rent control summary and landlord payable vs tenant receivable command panel needs stronger top-level visibility.

### F. Testing and release confidence (Medium)
- Test suite exists in tests/, but there is no explicit release-gate checklist tied to production deployment decisions.

## 4) Reliability and Safety Assessment
- Strength: web and worker responsibilities are separated for 24/7 operation.
- Strength: data is persisted in Postgres, not ephemeral filesystem.
- Strength: health snapshots and queue/worker checks already exist.
- Risk: operational errors can still feel opaque to non-technical staff when surfaced outside guided screens.
- Risk: external integration misconfiguration can create partial workflows unless centrally surfaced and blocked with clear guidance.

## 5) Immediate Work Completed In This Hardening Wave
- Root entry now routes directly into operational flow (not design-system demo).
- Internal home converted to Monday-morning quick-start orientation.
- Secondary tools collapsed behind "More tools" to reduce overload for non-technical users.
- Auth env validation hardening shipped to avoid startup crashes from partial provider configuration.
- Sign-in error handling improved to show user-readable credential errors instead of generic server crash screens.

## 6) Priority Roadmap (Execution Order)
1. Command Centre KPI upgrade (commercial row + actions row + health row).
2. Unified integration status board (AI, email, messaging, storage, connectors).
3. Persistent global navigation shell for internal routes (desktop sidebar + mobile quick nav).
4. Rent Control Centre summary + tenancy transition visibility from completed deals.
5. Morning briefing generator (overnight digest + priority opportunities + first actions).
6. Release-gate checklist and deployment runbook automation.

## 7) Definition of Done For Next Milestone
- Any team member can log in and know in under 60 seconds:
  - what happened overnight,
  - what is urgent,
  - who to contact first,
  - what actions move deals forward today.
- No module pretends integration success when disconnected.
- Worker + queue + integration state is visible and actionable from operations screens.
