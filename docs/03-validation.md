# Validation Report

**Author:** Oleksandr Mushynski  
**Status:** Living document — updated at the end of every phase in [`PLAN.md`](../PLAN.md); finalized in phase 9.

This document compares what was built against [`01-srs.md`](./01-srs.md): which requirements are covered and by which tests, what changed along the way, and what remains.

---

## 1. Traceability Matrix

Status: ⬜ planned · 🟡 in progress · ✅ implemented & tested · ⚠️ changed · ❌ dropped

### Functional Requirements

| ID | Requirement (short) | Phase | Test(s) | Status |
| :--- | :--- | :--- | :--- | :--- |
| FR-01 | Create & list workspaces | 4 | `apps/api/test/workspaces.e2e-spec.ts` (incl. atomicity on failure) | ✅ |
| FR-02 | Default `Development` + `Production` environments | 4 | `apps/api/test/workspaces.e2e-spec.ts`, `persistence.int-spec.ts` | ✅ |
| FR-03 | Secure SDK key per environment (`ff_live_` / `ff_test_`) | 4 | `apps/api/src/environments/sdk-key.spec.ts`, `apps/api/test/workspaces.e2e-spec.ts` | ✅ |
| FR-04 | Store only SHA-256 of SDK key; show raw key once | 4 | `apps/api/test/workspaces.e2e-spec.ts` (DB row holds only the hash; list endpoints never return keys) | ✅ |
| FR-05 | Revoke & regenerate SDK key | 4 | `apps/api/test/workspaces.e2e-spec.ts` (old key rejected immediately) | ✅ |
| FR-10 | Create flag (key, name, description, isEnabled, rollout, rules) | 3, 6 | `persistence.int-spec.ts` (DB constraints); `packages/shared/src/flags.spec.ts`; `apps/api/test/flags.e2e-spec.ts` (defaults, 409 duplicate, validation) | ✅ |
| FR-11 | Paginated list + search | 6 | `apps/api/test/flags.e2e-spec.ts` (pagination, newest first, case-insensitive search by key or name) | ✅ |
| FR-12 | Update flag configuration | 6 | `apps/api/test/flags.e2e-spec.ts` (partial update, immutable key, kill-switch effective on the next evaluation) | ✅ |
| FR-13 | Archive flag (soft delete) | 3, 6 | `persistence.int-spec.ts`; `apps/api/test/flags.e2e-spec.ts` (hidden from list/get, 404 on evaluate, terminal, key stays reserved) | ✅ |
| FR-20 | `POST /api/v1/evaluate` | 5 | `apps/api/test/evaluate.e2e-spec.ts` | ✅ |
| FR-21 | Resolution order: master → rules → rollout → default | 2 | `apps/api/src/evaluation/engine/evaluate.spec.ts`, `bucket.spec.ts` | ✅ |
| FR-22 | Missing `userId` → `MISSING_USER_ID` | 2 | `apps/api/src/evaluation/engine/evaluate.spec.ts` | ✅ |
| FR-23 | Operators `EQUALS`, `NOT_EQUALS`, `IN`, `CONTAINS`, `GREATER_THAN` | 2 | `apps/api/src/evaluation/engine/operators.spec.ts`, `packages/shared/src/evaluation.spec.ts` | ✅ |
| FR-24 | Stateless, deterministic, zero DB writes | 2, 5 | `evaluate.spec.ts` (pure engine); `apps/api/test/evaluate.e2e-spec.ts` records every DB operation during evaluation and asserts no writes (verified by injecting a write, which the test caught) | ✅ |
| FR-30 | Immutable audit entry on every flag mutation | 3, 6 | `persistence.int-spec.ts` (trigger); `apps/api/test/flags.e2e-spec.ts` (entry per mutation, rollback on failure, correct previous state under concurrency — verified to fail without the row lock) | ✅ |
| FR-31 | Audit entry fields | 6 | `apps/api/test/flags.e2e-spec.ts` (all fields, full before/after snapshots, filter by flag, pagination) | ✅ |
| FR-32 | JWT-authenticated management API | 6 | `apps/api/test/auth.e2e-spec.ts` (login, generic 401, tampered/forged tokens, logout, every management route requires a session); `auth.config.spec.ts` | ✅ |
| FR-33 | SDK key auth via `X-Environment-Key` | 4, 5 | `apps/api/test/evaluate.e2e-spec.ts` (missing / unknown / rotated key → 401; key scoped to its environment) | ✅ |

### Non-Functional Requirements

| ID | Requirement (short) | Phase | Verification | Status |
| :--- | :--- | :--- | :--- | :--- |
| NFR-01 | Evaluate p95 < 15 ms @ 500 req/s (aggregate across keys) | 5, 8 | `scripts/load-test.mjs` against the Docker image (open-loop, 500 req/s, 40 SDK keys, 30 s): run 1 — p50 2.79 ms, **p95 5.07 ms**, p99 54.8 ms; run 2 — p50 2.84 ms, **p95 4.83 ms**, p99 9.96 ms; 15 000+ requests, all `200` | ✅ |
| NFR-02 | Deterministic results across restarts & nodes | 2 | `apps/api/src/evaluation/engine/bucket.spec.ts` (golden vectors computed independently in Python), `evaluate.spec.ts` | ✅ |
| NFR-03 | `/healthz`, `/readyz` within 5 ms | 1, 3, 8 | `health.e2e-spec.ts` (200 / 503); Docker image, 50 requests each: `/healthz` p95 2.2 ms, `/readyz` p95 4.3 ms (one outlier at 14.9 ms) | ✅ at p95 |
| NFR-04 | No client context stored during evaluation | 2, 5 | Pure engine; zero DB writes (`apps/api/test/evaluate.e2e-spec.ts`); the only in-memory state is the rate limiter's token count per environment | ✅ |

### Security Requirements

| ID | Requirement (short) | Phase | Test(s) | Status |
| :--- | :--- | :--- | :--- | :--- |
| SEC-01 | SDK keys never stored in plain text | 4, 5 | `sdk-key.spec.ts`, `apps/api/test/workspaces.e2e-spec.ts`; request headers/bodies are never logged (`AllExceptionsFilter` logs only 5xx stacks) | ✅ |
| SEC-02 | HTTP-only, SameSite=Lax JWT cookie, 12 h TTL | 6 | `apps/api/test/auth.e2e-spec.ts` (cookie attributes; valid at 11:59:59, expired at 12:00:00 via `FakeClock`) | ✅ |
| SEC-03 | Zod validation, structured `400` | 4, 5 | `zod-validation.pipe.spec.ts`, `all-exceptions.filter.spec.ts`, `workspaces.e2e-spec.ts`, `apps/api/test/evaluate.e2e-spec.ts` | ✅ |
| SEC-04 | Per-SDK-key token bucket, `RATE_LIMIT_PER_MINUTE` (default 1000/min) | 5 | `token-bucket.spec.ts` (1000/min, refill, cap, per key, `Retry-After`, env parsing with fail-fast); `apps/api/test/evaluate.e2e-spec.ts` (429 + recovery, per environment, invalid keys consume no tokens) | ✅ |

### Acceptance Criteria

| ID | Scenario | Phase | Test | Status |
| :--- | :--- | :--- | :--- | :--- |
| AC-01 | Deterministic percentage rollout | 2, 5 | Engine: `evaluate.spec.ts`; HTTP: `apps/api/test/acceptance.e2e-spec.ts` (100 requests + boundary at 28%) | ✅ |
| AC-02 | Targeting rule override | 2, 5 | Engine: `evaluate.spec.ts`; HTTP: `apps/api/test/acceptance.e2e-spec.ts` | ✅ |
| AC-03 | Disabled master switch | 2, 5 | Engine: `evaluate.spec.ts`; HTTP: `apps/api/test/acceptance.e2e-spec.ts` | ✅ |

---

### Dashboard (Scope v1: Web Dashboard)

| Capability (00-problem.md) | Phase | Verification | Status |
| :--- | :--- | :--- | :--- |
| Flag creation | 7 | Manual walkthrough in the browser (phase 7) | ✅ |
| Targeting rule configuration | 7 | `apps/web/src/lib/rules.spec.ts` (parsing, typing, validation messages); manual walkthrough | ✅ |
| Percentage rollout slider | 7 | Manual walkthrough; bucket grid reflects the percentage | ✅ |
| Evaluation testing playground | 7 | Manual walkthrough: real `POST /evaluate`, `usr_1001` highlighted in bucket 28 (matches AC-01); `apps/web/src/lib/bucket.spec.ts` pins the browser port to the server's golden vectors | ✅ |
| Audit logs | 7 | `apps/web/src/lib/diff.spec.ts`; manual walkthrough shows per-field before → after | ✅ |
| Kill-switch | 7 | Manual walkthrough: toggle in the flags table and editor | ✅ |
| Success criterion: `docker compose up` + `scripts/demo.sh` | 8 | Isolated compose project with no `.env`: migrations applied on start, login, 50% flag, 100 identical evaluations, 98/200 users on, kill-switch applied | ✅ |
| SPA served by the API (ADR-0007) | 7 | Manual check: dashboard routes return `index.html`; `/api/*` unknown paths stay JSON 404 | ✅ |

## 2. Requirement Changes

Changes I made to the SRS after validating it against the design and implementation.

| SRS version | Change | Trigger | Decision |
| :--- | :--- | :--- | :--- |
| 1.1.0 | FR-13 changed from hard delete to soft delete (`archived_at`) | Design review: hard delete conflicts with the immutable `audit_logs.flag_id` FK | Soft delete; archived flags evaluate as `404`, history preserved |
| 1.1.0 | §3: single env-configured admin, `actorId` = admin email | Design review: FR-32 requires sessions, but the data model has no users | Single admin ([ADR-0006](./adr/0006-single-admin.md)); multi-user is a v1 non-goal |
| 1.1.0 | §6: `UNIQUE (environment_id, key)` | FR-10 requires uniqueness, ER model did not express it | Constraint added to the data model |
| 1.2.0 | §4.5: flag lifecycle state machine | Soft delete introduced a third state that needed explicit rules | `Disabled ⇄ Enabled → Archived`; `Archived` is terminal |
| 1.2.1 | AC-01 states the expected bucket and value; boundary case added | Phase 2: AC-01 only held because of a specific hash output | Expected bucket `28` written into the criterion; `bucket == percentageRollout` → `DEFAULT` |
| 1.3.0 | SEC-04 limit configurable (`RATE_LIMIT_PER_MINUTE`, default 1000/min); NFR-01 load is aggregate across SDK keys | Phase 5: NFR-01 and SEC-04 conflicted for a single key; 1000/min is too low for some legitimate server-side clients | Configurable limit with a conservative default |

---

## 3. Incorrect Assumptions Discovered

| Phase | Finding | Impact | Action |
| :--- | :--- | :--- | :--- |
| 2 | **AC-01 silently depends on the hash output.** It expects `reason: "PERCENTAGE_ROLLOUT"` for `usr_1001` at 30%, which is only true because `bucket("usr_1001", "new-checkout") = 28`. With a different user ID the same scenario would return `DEFAULT`. | The acceptance criterion is correct today but brittle and not self-explanatory. | Bucket value pinned by a golden-vector test, so AC-01 cannot break unnoticed. SRS v1.2.1: AC-01 now states the expected bucket (28), the expected value, and the strict boundary case. |
| 3 | The design specified an `UPDATE`/`DELETE` trigger for audit immutability, but PostgreSQL `TRUNCATE` bypasses row-level triggers. | Audit history could still be wiped with one statement. | Added a statement-level `BEFORE TRUNCATE` trigger; design §7 updated; covered by a test. |
| 3 | Prisma refuses `migrate reset` when run by an AI agent (safety guard against destroying a developer database). | The planned test setup could not use `reset`. | Kept the guard intact. Test setup creates `<db>_test`, drops only its schema, and runs `migrate deploy`; it refuses any database whose name does not end with `_test`. |
| 8 | Default `Secure` cookies in production break login on plain-HTTP self-hosted deployments (e.g. an internal IP). | Admins could not sign in on such a deployment. | `COOKIE_SECURE` override (default unchanged); compose demo uses `false`, README recommends `true` behind HTTPS. |
| 8 | `prisma` was a dev dependency, but `migrate deploy` runs in the production container on start. | The production image could not apply migrations. | Moved `prisma` to dependencies. |
| 7 | Because only SDK key hashes are stored (FR-04), the dashboard cannot evaluate on the user's behalf without the raw key. | The playground cannot work out of the box. | The playground asks for the environment's key (kept in `sessionStorage` for the tab). Design §9 updated. |
| 6 | `jsonwebtoken` reads the system clock for `iat`/`exp`, which would bypass the `Clock` rule and make expiry untestable. | Session expiry could not be tested deterministically. | `iat`/`exp` set explicitly from `Clock`; verification uses `clockTimestamp` from `Clock`. Expiry tested at the exact 12 h boundary. |
| 6 | Design did not cover concurrent updates: two simultaneous PATCHes could both record the same `previousState`. | Audit history could misstate what changed. | Row lock (`SELECT … FOR UPDATE`) before each update/archive; design §7 updated; concurrency test fails without the lock. |
| 6 | A bcrypt hash contains `$`, which docker compose interpolates in `.env`. | The admin login would silently break in Docker. | `.env.example` documents single-quoting the hash. |
| 5 | **NFR-01 and SEC-04 cannot both be exercised with one SDK key.** NFR-01 requires 500 req/s; SEC-04 caps one key at 1000 req/min (≈ 16.7 req/s sustained). A single-key load test is throttled within 2 seconds. | The NFR-01 load test must spread traffic across ≥ 30 environments. It also raises a product question: one backend service evaluating a flag per request can exceed 1000/min on its own. | **Decided:** limit made configurable via `RATE_LIMIT_PER_MINUTE` (default 1000); NFR-01 defined as aggregate load across keys → SRS v1.3.0. |
| 2 | SRS does not define operator edge cases (type coercion, missing attributes, case sensitivity). | Different implementations could disagree. | Defined in design §5.4 and covered by `operators.spec.ts`: strict typing, missing attribute never matches, case-sensitive. |

## 4. What Remains / Next Iteration

_To be filled in phase 9._

## 5. Technical Debt (Accepted Shortcuts)

_To be filled in phase 9. Known candidates from the ADRs:_

- In-memory rate limiter is per process ([ADR-0005](./adr/0005-in-memory-rate-limiter.md)).
- Single shared admin account ([ADR-0006](./adr/0006-single-admin.md)).
- Targeting rule shape validated only in application code ([ADR-0002](./adr/0002-jsonb-targeting-rules.md)).
- No login rate limiting / lockout: the SRS does not require it; bcrypt cost 12 slows brute force but does not stop it.
- CSRF protection relies on `SameSite=Lax` cookies and JSON-only endpoints; no CSRF token.
- Sessions cannot be revoked server-side before expiry (stateless JWT); logout only clears the cookie.
- Dashboard has no rendered-component or browser e2e tests; its logic is unit-tested and the UI was verified manually.
- Dashboard fonts load from Google Fonts; an air-gapped deployment falls back to system fonts.
- The browser bucket port duplicates the server algorithm for display; it is pinned by golden-vector tests but is a second copy to keep in sync.
- `docker-compose.yml` ships demo credentials and `COOKIE_SECURE=false` so the stack starts with no setup; operators must override them.
- The Docker image is ~760 MB (Debian base + Prisma engines); not optimized for size.
- p99 latency under load had one run at 54.8 ms (likely JIT warm-up); tail latency was not investigated further.

## 6. Risks Toward Production

_To be filled in phase 9._
