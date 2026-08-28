# Authentication and RBAC

PQ COMMAND uses Auth.js with Microsoft Entra ID for internal authentication.

## Security boundaries

- PQ does not store or verify passwords.
- Internal routes are protected by middleware and server-side route/page checks.
- Sessions use Auth.js JWT strategy with secure cookies enabled in production.
- Role resolution is environment-driven until a real directory sync layer is introduced.

## Roles

- `ADMIN`: full access, including user management.
- `MANAGER`: operational management access without user administration.
- `AGENT`: authenticated operational access.

## Current helpers

- `getCurrentUser`
- `requireCurrentUser`
- `requireCurrentUserPermission`
- `canManageSources`
- `canSendOutreach`
- `canManageUsers`

## Configuration

The following values must be configured together before sign-in is enabled:

- `AUTH_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_ID`
- `AUTH_MICROSOFT_ENTRA_ID_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_ISSUER`

Role assignment is currently derived from:

- `AUTH_ADMIN_EMAILS`
- `AUTH_MANAGER_EMAILS`

Until those variables are configured, the sign-in page remains public but does not connect production users.
