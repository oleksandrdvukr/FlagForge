# ADR-0006: Single env-configured admin

- **Status:** Accepted
- **Date:** 2026-10-14
- **Related:** FR-32, SEC-02, SRS §3, Non-goals (RBAC)

## Context

The management API requires JWT sessions (FR-32), but multi-user RBAC is a v1 non-goal and the SRS data model has no users table. Audit logs still need an actor identity (FR-31).

## Options

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. One admin from env (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`)** | No user model, no signup flow, matches scope | One shared login per deployment |
| B. `users` table with registration | Real multi-user | User management UI, password reset — out of scope |
| C. External OAuth / OIDC | No password handling | Requires an identity provider; breaks the self-host-in-one-command goal |

## Decision

**Option A.** The password is stored as a bcrypt hash in the environment, never in plain text. `actor_id` in audit logs is the admin email.

## Consequences

- ✅ Login works immediately after `docker compose up`.
- ⚠️ Everyone with the credentials appears as the same actor in audit logs. A `users` table is the first v2 candidate.
