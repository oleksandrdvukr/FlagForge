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
| FR-01 | Create & list workspaces | 4 | — | ⬜ |
| FR-02 | Default `Development` + `Production` environments | 4 | — | ⬜ |
| FR-03 | Secure SDK key per environment (`ff_live_` / `ff_test_`) | 4 | — | ⬜ |
| FR-04 | Store only SHA-256 of SDK key; show raw key once | 4 | — | ⬜ |
| FR-05 | Revoke & regenerate SDK key | 4 | — | ⬜ |
| FR-10 | Create flag (key, name, description, isEnabled, rollout, rules) | 3, 6 | `apps/api/test/persistence.int-spec.ts` (defaults, unique key per environment, CHECK on rollout and key format) | 🟡 DB constraints ✅; API in phase 6 |
| FR-11 | Paginated list + search | 6 | — | ⬜ |
| FR-12 | Update flag configuration | 6 | — | ⬜ |
| FR-13 | Archive flag (soft delete) | 3, 6 | `apps/api/test/persistence.int-spec.ts` (hard delete of an audited flag is rejected) | 🟡 API in phase 6 |
| FR-20 | `POST /api/v1/evaluate` | 5 | — | ⬜ |
| FR-21 | Resolution order: master → rules → rollout → default | 2 | `apps/api/src/evaluation/engine/evaluate.spec.ts`, `bucket.spec.ts` | ✅ |
| FR-22 | Missing `userId` → `MISSING_USER_ID` | 2 | `apps/api/src/evaluation/engine/evaluate.spec.ts` | ✅ |
| FR-23 | Operators `EQUALS`, `NOT_EQUALS`, `IN`, `CONTAINS`, `GREATER_THAN` | 2 | `apps/api/src/evaluation/engine/operators.spec.ts`, `packages/shared/src/evaluation.spec.ts` | ✅ |
| FR-24 | Stateless, deterministic, zero DB writes | 2, 5 | `apps/api/src/evaluation/engine/evaluate.spec.ts` (pure, no mutation) | 🟡 zero-writes check at API level in phase 5 |
| FR-30 | Immutable audit entry on every flag mutation | 3, 6 | `apps/api/test/persistence.int-spec.ts` (UPDATE / DELETE / TRUNCATE rejected by trigger) | 🟡 DB immutability ✅; entry on every mutation in phase 6 |
| FR-31 | Audit entry fields | 6 | — | ⬜ |
| FR-32 | JWT-authenticated management API | 6 | — | ⬜ |
| FR-33 | SDK key auth via `X-Environment-Key` | 5 | — | ⬜ |

### Non-Functional Requirements

| ID | Requirement (short) | Phase | Verification | Status |
| :--- | :--- | :--- | :--- | :--- |
| NFR-01 | Evaluate p95 < 15 ms @ 500 req/s | 8 | — | ⬜ |
| NFR-02 | Deterministic results across restarts & nodes | 2 | `apps/api/src/evaluation/engine/bucket.spec.ts` (golden vectors computed independently in Python), `evaluate.spec.ts` | ✅ |
| NFR-03 | `/healthz`, `/readyz` within 5 ms | 1, 3 | `apps/api/test/health.e2e-spec.ts` (200 with DB up, 503 with DB down); manual check against a real stopped container | ✅ latency measured under load in phase 8 |
| NFR-04 | No client context stored during evaluation | 2, 5 | Engine is a pure function with no state | 🟡 API level in phase 5 |

### Security Requirements

| ID | Requirement (short) | Phase | Test(s) | Status |
| :--- | :--- | :--- | :--- | :--- |
| SEC-01 | SDK keys never stored in plain text | 4 | — | ⬜ |
| SEC-02 | HTTP-only, SameSite=Lax JWT cookie, 12 h TTL | 6 | — | ⬜ |
| SEC-03 | Zod validation, structured `400` | 5 | — | ⬜ |
| SEC-04 | 1000 req/min per SDK key, token bucket | 5 | — | ⬜ |

### Acceptance Criteria

| ID | Scenario | Phase | Test | Status |
| :--- | :--- | :--- | :--- | :--- |
| AC-01 | Deterministic percentage rollout | 2, 5 | Engine: `apps/api/src/evaluation/engine/evaluate.spec.ts` | 🟡 e2e in phase 5 |
| AC-02 | Targeting rule override | 2, 5 | Engine: `apps/api/src/evaluation/engine/evaluate.spec.ts` | 🟡 e2e in phase 5 |
| AC-03 | Disabled master switch | 2, 5 | Engine: `apps/api/src/evaluation/engine/evaluate.spec.ts` | 🟡 e2e in phase 5 |

---

## 2. Requirement Changes

Changes I made to the SRS after validating it against the design and implementation.

| SRS version | Change | Trigger | Decision |
| :--- | :--- | :--- | :--- |
| 1.1.0 | FR-13 changed from hard delete to soft delete (`archived_at`) | Design review: hard delete conflicts with the immutable `audit_logs.flag_id` FK | Soft delete; archived flags evaluate as `404`, history preserved |
| 1.1.0 | §3: single env-configured admin, `actorId` = admin email | Design review: FR-32 requires sessions, but the data model has no users | Single admin ([ADR-0006](./adr/0006-single-admin.md)); multi-user is a v1 non-goal |
| 1.1.0 | §6: `UNIQUE (environment_id, key)` | FR-10 requires uniqueness, ER model did not express it | Constraint added to the data model |
| 1.2.0 | §4.5: flag lifecycle state machine | Soft delete introduced a third state that needed explicit rules | `Disabled ⇄ Enabled → Archived`; `Archived` is terminal |
| 1.2.1 | AC-01 states the expected bucket and value; boundary case added | Phase 2: AC-01 only held because of a specific hash output | Expected bucket `28` written into the criterion; `bucket == percentageRollout` → `DEFAULT` |

---

## 3. Incorrect Assumptions Discovered

| Phase | Finding | Impact | Action |
| :--- | :--- | :--- | :--- |
| 2 | **AC-01 silently depends on the hash output.** It expects `reason: "PERCENTAGE_ROLLOUT"` for `usr_1001` at 30%, which is only true because `bucket("usr_1001", "new-checkout") = 28`. With a different user ID the same scenario would return `DEFAULT`. | The acceptance criterion is correct today but brittle and not self-explanatory. | Bucket value pinned by a golden-vector test, so AC-01 cannot break unnoticed. SRS v1.2.1: AC-01 now states the expected bucket (28), the expected value, and the strict boundary case. |
| 3 | The design specified an `UPDATE`/`DELETE` trigger for audit immutability, but PostgreSQL `TRUNCATE` bypasses row-level triggers. | Audit history could still be wiped with one statement. | Added a statement-level `BEFORE TRUNCATE` trigger; design §7 updated; covered by a test. |
| 3 | Prisma refuses `migrate reset` when run by an AI agent (safety guard against destroying a developer database). | The planned test setup could not use `reset`. | Kept the guard intact. Test setup creates `<db>_test`, drops only its schema, and runs `migrate deploy`; it refuses any database whose name does not end with `_test`. |
| 2 | SRS does not define operator edge cases (type coercion, missing attributes, case sensitivity). | Different implementations could disagree. | Defined in design §5.4 and covered by `operators.spec.ts`: strict typing, missing attribute never matches, case-sensitive. |

## 4. What Remains / Next Iteration

_To be filled in phase 9._

## 5. Technical Debt (Accepted Shortcuts)

_To be filled in phase 9. Known candidates from the ADRs:_

- In-memory rate limiter is per process ([ADR-0005](./adr/0005-in-memory-rate-limiter.md)).
- Single shared admin account ([ADR-0006](./adr/0006-single-admin.md)).
- Targeting rule shape validated only in application code ([ADR-0002](./adr/0002-jsonb-targeting-rules.md)).

## 6. Risks Toward Production

_To be filled in phase 9._
