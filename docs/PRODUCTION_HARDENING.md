# Production Hardening Report

Date: 2026-08-28

## Scope

This pass covered production hardening for security, accessibility, and performance without changing core product behavior.

## Security

Implemented:
- RBAC remains enforced server-side on internal/admin surfaces and mutation paths.
- Added secure response headers in Next.js: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.
- Added lightweight rate limiting for private-admin credential login attempts.
- Added lightweight rate limiting for the admin users API.
- Added `Cache-Control: private, no-store` to authenticated internal/admin traffic.
- Added `Cache-Control: no-store` to operational health responses.
- Kept stack-native CSRF/session protections through NextAuth handlers and server actions.
- Upgraded `drizzle-orm` to `0.45.2` to remediate the high-severity SQL identifier escaping advisory.

Reviewed:
- Secrets scan on tracked source/docs/config paths found only placeholder keys in `.env.example`.
- No committed private key material was detected in tracked source files.

Notes:
- Secret scan noise was present under generated `.next` build artifacts; those are not treated as repository source of truth.
- Rate limiting is in-memory and protects a single app instance. For multi-instance production, replace with shared-store rate limiting.

## Accessibility

Implemented:
- Added skip link for keyboard users.
- Added explicit focus target on main content.
- Preserved labeled form controls across key internal pages.
- Replaced inbox conversation anchor blocks with semantic `Link` navigation.
- Retained reduced-motion behavior in global CSS.

Manual audit status:
- Lead Room: keyboard reachable, forms labeled, drawer flows usable.
- Inbox: keyboard reachable, filters/actions labeled, thread navigation usable.
- Stock Room: keyboard reachable, filters/forms labeled.
- Sign-in: keyboard reachable, credentials fields labeled via form structure.

Residual manual checks recommended:
- Screen-reader pass on complex multi-form pages.
- Contrast verification in browser devtools for every badge variant.

## Performance

Implemented:
- Added server-side pagination to large list pages:
  - Lead Room
  - Inbox
  - Stock Room
- Added database indexes for new high-frequency filters/orderings.
- Replaced CSS background-image previews with `next/image` on stock/property media surfaces.
- Preserved server-side filtering for inventory and inbox list queries.

## Validation

Code/data validation completed:
- TypeScript compile index: clean
- Dependency audit (`npm audit --omit=dev --audit-level=high`): clean after upgrade

Follow-up operational validation still required:
- Browser accessibility pass with assistive tooling
- Production-like load verification against hosted database
- Shared-store rate limiting if deployed behind multiple instances
