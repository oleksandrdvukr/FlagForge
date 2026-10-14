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
| FR-10 | Create flag (key, name, description, isEnabled, rollout, rules) | 6 | — | ⬜ |
| FR-11 | Paginated list + search | 6 | — | ⬜ |
| FR-12 | Update flag configuration | 6 | — | ⬜ |
| FR-13 | Archive flag (soft delete) | 6 | — | ⬜ |
| FR-20 | `POST /api/v1/evaluate` | 5 | — | ⬜ |
| FR-21 | Resolution order: master → rules → rollout → default | 2 | — | ⬜ |
| FR-22 | Missing `userId` → `MISSING_USER_ID` | 2 | — | ⬜ |
| FR-23 | Operators `EQUALS`, `NOT_EQUALS`, `IN`, `CONTAINS`, `GREATER_THAN` | 2 | — | ⬜ |
| FR-24 | Stateless, deterministic, zero DB writes | 2, 5 | — | ⬜ |
| FR-30 | Immutable audit entry on every flag mutation | 3, 6 | — | ⬜ |
| FR-31 | Audit entry fields | 6 | — | ⬜ |
| FR-32 | JWT-authenticated management API | 6 | — | ⬜ |
| FR-33 | SDK key auth via `X-Environment-Key` | 5 | — | ⬜ |

### Non-Functional Requirements

| ID | Requirement (short) | Phase | Verification | Status |
| :--- | :--- | :--- | :--- | :--- |
| NFR-01 | Evaluate p95 < 15 ms @ 500 req/s | 8 | — | ⬜ |
| NFR-02 | Deterministic results across restarts & nodes | 2 | — | ⬜ |
| NFR-03 | `/healthz`, `/readyz` within 5 ms | 1, 3 | `apps/api/test/health.e2e-spec.ts`; manual: `/healthz` ≈ 8 ms on cold process | 🟡 `/readyz` DB ping comes in phase 3 |
| NFR-04 | No client context stored during evaluation | 2, 5 | — | ⬜ |

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
| AC-01 | Deterministic percentage rollout | 5 | — | ⬜ |
| AC-02 | Targeting rule override | 5 | — | ⬜ |
| AC-03 | Disabled master switch | 5 | — | ⬜ |

---

## 2. Requirement Changes

Changes I made to the SRS after validating it against the design and implementation.

| SRS version | Change | Trigger | Decision |
| :--- | :--- | :--- | :--- |
| 1.1.0 | FR-13 changed from hard delete to soft delete (`archived_at`) | Design review: hard delete conflicts with the immutable `audit_logs.flag_id` FK | Soft delete; archived flags evaluate as `404`, history preserved |
| 1.1.0 | §3: single env-configured admin, `actorId` = admin email | Design review: FR-32 requires sessions, but the data model has no users | Single admin ([ADR-0006](./adr/0006-single-admin.md)); multi-user is a v1 non-goal |
| 1.1.0 | §6: `UNIQUE (environment_id, key)` | FR-10 requires uniqueness, ER model did not express it | Constraint added to the data model |
| 1.2.0 | §4.5: flag lifecycle state machine | Soft delete introduced a third state that needed explicit rules | `Disabled ⇄ Enabled → Archived`; `Archived` is terminal |

---

## 3. Incorrect Assumptions Discovered

_To be filled during implementation (phases 1–8)._

## 4. What Remains / Next Iteration

_To be filled in phase 9._

## 5. Technical Debt (Accepted Shortcuts)

_To be filled in phase 9. Known candidates from the ADRs:_

- In-memory rate limiter is per process ([ADR-0005](./adr/0005-in-memory-rate-limiter.md)).
- Single shared admin account ([ADR-0006](./adr/0006-single-admin.md)).
- Targeting rule shape validated only in application code ([ADR-0002](./adr/0002-jsonb-targeting-rules.md)).

## 6. Risks Toward Production

_To be filled in phase 9._
