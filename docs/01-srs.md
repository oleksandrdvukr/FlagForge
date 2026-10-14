# Software Requirements Specification (SRS)

| | |
| :--- | :--- |
| **Project Name** | FlagForge — Feature Flag & Dynamic Config Engine |
| **Document Version** | 1.4.0 |
| **Status** | Approved |

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Glossary](#2-glossary)
3. [Actors](#3-actors)
4. [Functional Requirements (FR-xx)](#4-functional-requirements-fr-xx)
5. [Flag Evaluation Logic & Flow](#5-flag-evaluation-logic--flow)
6. [Data Model (ER-Diagram)](#6-data-model-er-diagram)
7. [Non-Functional Requirements (NFR-xx)](#7-non-functional-requirements-nfr-xx)
8. [Security Requirements (SEC-xx)](#8-security-requirements-sec-xx)
9. [Acceptance Criteria (AC-xx)](#9-acceptance-criteria-ac-xx)
10. [Open Questions & Change Log](#10-open-questions--change-log)

---

## 1. Purpose & Scope

This document specifies the software requirements for **FlagForge**, a B2B SaaS / DevTool feature flag and dynamic configuration management engine. FlagForge enables software engineering teams to decouple code deployments from feature releases through deterministic percentage rollouts, attribute-based targeting rules, and instantaneous kill-switches.

> For the problem context, targeted audience, and scope boundaries, refer to [`docs/00-problem.md`](./00-problem.md).

### 1.1 Product Goals

| # | Goal | Measured by |
| :--- | :--- | :--- |
| G-1 | Ship code to production dark and expose it gradually, without a redeploy. | FR-10 – FR-12, FR-21, UC-01 |
| G-2 | Turn a broken feature off for everyone within one second. | FR-12, FR-21 (`DISABLED` on the next evaluation), UC-02 |
| G-3 | Give each user a stable experience: the same user gets the same answer, and raising a rollout only adds users. | NFR-02, AC-01 |
| G-4 | Know who changed which flag, when, and from what to what. | FR-30, FR-31, UC-05 |
| G-5 | Run the whole product with one command on one machine. | Success criterion in `00-problem.md`, NFR-01 |

### 1.2 Constraints

| # | Constraint | Consequence | Source |
| :--- | :--- | :--- | :--- |
| C-1 | Self-hosted as one application image plus PostgreSQL 16, started with `docker compose up`. | No external services (cache, queue, identity provider) in v1. | `00-problem.md` success criterion, ADR-0001 |
| C-2 | Single application instance. | The rate limiter (SEC-04) may keep its state in memory. | ADR-0001, ADR-0005 |
| C-3 | One administrator, configured through environment variables. | No user management; every audit entry has the same `actorId`. | §3, ADR-0006 |
| C-4 | Flags are boolean. | Rules and rollouts resolve to `true` / `false` only. | §10, Open Question 1 |
| C-5 | Evaluation is read-only. | No evaluation counts or impressions are stored (FR-24). | §10, Open Question 2 |
| C-6 | The bucketing algorithm is fixed for v1. | Changing it would move users between buckets (NFR-02). | §5, ADR-0004 |

### 1.3 Assumptions

If an assumption turns out to be false, the listed requirement must be revisited.

| # | Assumption | If it is false |
| :--- | :--- | :--- |
| A-1 | Client applications send a stable `userId` for each end user. | A user whose ID changes may land in a different bucket (FR-21, NFR-02). |
| A-2 | SDK keys are secrets of the calling service. v1 has no separate public key type for code running in browsers or mobile apps. | A key shipped in a frontend can be read by its users; rotation (FR-05) is the remedy. |
| A-3 | Attribute values in the Evaluation Context are supplied and vouched for by the client; FlagForge does not verify them. | A client sending wrong attributes gets wrong targeting (FR-23). |
| A-4 | PostgreSQL is available while evaluations run; clients keep their own fallback value for when FlagForge cannot answer. | Without a client-side fallback, a database outage stops features that depend on flags (no cache in v1, ADR-0003). |
| A-5 | Production deployments terminate TLS in a reverse proxy in front of FlagForge. | Session cookies would travel over plain HTTP (SEC-02). |
| A-6 | Load stays within NFR-01: about 500 evaluations per second in total on one instance. | Horizontal scaling becomes necessary, which C-2 does not allow in v1. |

---

## 2. Glossary

| Term | Definition |
| :--- | :--- |
| **Workspace** | Top-level tenant isolating its environments, feature flags, and audit history. |
| **Environment** | A deployment stage within a Workspace (e.g., `Development`, `Production`) with its own SDK keys. |
| **Feature Flag** | A decision point in application code that dynamically evaluates to a boolean (`true`/`false`) in v1; multivariate payloads are deferred (§10, Open Question 1). |
| **Evaluation Context** | JSON payload sent by client applications containing a `userId` and contextual `attributes`. |
| **Targeting Rule** | A conditional rule mapping context attributes to a flag evaluation result (`true` or `false`). |
| **Percentage Rollout** | A deterministic 0–100% allocation strategy using context hashing without mutating state. |
| **SDK Key** | An environment-scoped token used by client applications to authenticate evaluation requests. |
| **Audit Log** | An immutable record tracking configuration modifications, previous states, and actor identities. |

---

## 3. Actors

| # | Actor | Type | Description |
| :--- | :--- | :--- | :--- |
| 1 | **Workspace Admin (Operator)** | Human | Interacts with the FlagForge Dashboard to manage workspaces, flags, environments, and view audit logs. In v1 there is a single bootstrap admin configured via environment variables (no users table); the admin email is used as `actorId` in audit logs. |
| 2 | **Client Application (SDK)** | Machine | Runs in client backend/frontend services and calls the Evaluation API to resolve feature flag states. |
| 3 | **Evaluation Engine** | Internal component | Stateless domain component responsible for executing targeting rules and hashing functions. |

### 3.1 Use Cases

| # | Use case | Actor | Main flow | Requirements |
| :--- | :--- | :--- | :--- | :--- |
| UC-01 | Gradual release | Workspace Admin | Create the flag (off by default) → deploy code that checks it → turn it on with a 5% rollout → raise to 50%, then 100%. Users already in the rollout stay in it. | FR-10, FR-12, FR-21, NFR-02 |
| UC-02 | Incident kill-switch | Workspace Admin | A released feature misbehaves → the admin turns the flag off → the next evaluation returns `DISABLED` for every user, with no redeploy. | FR-12, FR-21, FR-24 |
| UC-03 | Targeted beta | Workspace Admin | Add a rule such as `plan EQUALS enterprise → true` while the rollout stays at 0%: only matching users get the feature. | FR-12, FR-21, FR-23, AC-02 |
| UC-04 | Evaluate a flag | Client Application | Send `POST /api/v1/evaluate` with the environment's SDK key and the Evaluation Context → receive `value` and `reason`. | FR-20 – FR-24, FR-33, SEC-03, SEC-04 |
| UC-05 | Review changes | Workspace Admin | Open the environment's audit log → see each change with its actor, time, and previous and new state. | FR-30, FR-31 |
| UC-06 | Replace a leaked SDK key | Workspace Admin | Rotate the environment's key → the new key is shown once → the old key is rejected from the next request. | FR-03 – FR-05, SEC-01 |

---

## 4. Functional Requirements (FR-xx)

### 4.1 Workspace & Environment Management

| ID | Requirement |
| :--- | :--- |
| **FR-01** | The system shall allow creating and listing Workspaces. |
| **FR-02** | Each Workspace shall contain default Environments (`Development` and `Production`). |
| **FR-03** | The system shall generate a cryptographically secure, unguessable SDK key for each Environment upon creation (prefix: `ff_live_` or `ff_test_`). |
| **FR-04** | The system shall store only the SHA-256 hash of SDK keys. The raw key shall be displayed to the Workspace Admin strictly once upon generation. |
| **FR-05** | The system shall support revoking and re-generating SDK keys for an Environment. |

### 4.2 Feature Flag Management

**FR-10:** The Workspace Admin shall be able to create a Feature Flag specifying:

| Field | Type | Constraints | Default |
| :--- | :--- | :--- | :--- |
| `key` | string | Unique slug per environment, regex `^[a-z0-9-_]{3,64}$` | — |
| `name` | string | Human-readable label, 1–100 characters | — |
| `description` | string | Optional, max 500 characters | — |
| `isEnabled` | boolean | Global master toggle | `false` |
| `percentageRollout` | integer | `0`–`100` | `0` |
| `targetingRules` | array | Array of conditional targeting objects | `[]` |

| ID | Requirement |
| :--- | :--- |
| **FR-11** | The Workspace Admin shall be able to view a paginated list of flags and search by key or name. |
| **FR-12** | The Workspace Admin shall be able to update flag configuration (`isEnabled`, `percentageRollout`, `targetingRules`). |
| **FR-13** | The Workspace Admin shall be able to archive (soft-delete) a feature flag by setting `archivedAt`. Archived flags are excluded from listings and evaluate as `404 Flag Not Found`; their audit history is preserved. |

### 4.3 Evaluation Engine

**FR-20:** The system shall provide a high-performance HTTP endpoint `POST /api/v1/evaluate` accepting an `Evaluation Context`:

```json
{
  "flagKey": "new-checkout-flow",
  "userId": "usr_99211",
  "attributes": {
    "plan": "enterprise",
    "country": "UA"
  }
}
```

**FR-21:** The evaluation engine shall resolve the flag state in strict hierarchical order:

| Step | Condition | `value` | `reason` |
| :--- | :--- | :--- | :--- |
| 1. **Master Switch** | `flag.isEnabled == false` | `false` | `DISABLED` |
| 2. **Targeting Rules** | First rule (in order) that matches the context | `rule.value` | `TARGETING_MATCH` |
| 3. **Percentage Rollout** | `bucket(userId, flagKey) < percentageRollout`, with `bucket` as defined in §5 | `true` | `PERCENTAGE_ROLLOUT` |
| 4. **Fallback** | None of the above | `false` | `DEFAULT` |

| ID | Requirement |
| :--- | :--- |
| **FR-22** | If `userId` is missing and a percentage rollout is evaluated, the system shall evaluate rollout to `false` and record `reason: "MISSING_USER_ID"`. |
| **FR-23** | The system shall support the following targeting rule operators: `EQUALS`, `NOT_EQUALS`, `IN`, `CONTAINS`, `GREATER_THAN`. |
| **FR-24** | Evaluation shall be stateless, deterministic, and produce zero database write operations. |

### 4.4 Audit Logging & Security

| ID | Requirement |
| :--- | :--- |
| **FR-30** | The system shall record an immutable Audit Log entry whenever a flag is created, modified, or archived. |
| **FR-31** | An Audit Log entry shall store: `id`, `environmentId`, `flagId`, `action` (`CREATED`, `UPDATED` or `ARCHIVED`), `actorId`, `previousState` (JSON, empty for `CREATED`), `newState` (JSON), and `timestamp`. |
| **FR-32** | The system shall authenticate management API requests using signed JWT sessions. |
| **FR-33** | The system shall authenticate Evaluation API requests using Environment SDK Keys passed in the `X-Environment-Key` HTTP header. |

### 4.5 Flag Lifecycle (State Machine)

```mermaid
stateDiagram-v2
  [*] --> Disabled : create (FR-10, isEnabled = false)
  Disabled --> Enabled : isEnabled = true (FR-12)
  Enabled --> Disabled : isEnabled = false — kill-switch (FR-12)
  Disabled --> Disabled : update rollout / rules (FR-12)
  Enabled --> Enabled : update rollout / rules (FR-12)
  Disabled --> Archived : archive (FR-13)
  Enabled --> Archived : archive (FR-13)
  Archived --> [*]
```

| State | `isEnabled` | `archivedAt` | Evaluation result |
| :--- | :--- | :--- | :--- |
| **Disabled** | `false` | `NULL` | `value: false`, `reason: "DISABLED"` |
| **Enabled** | `true` | `NULL` | Targeting rules → percentage rollout → default (FR-21) |
| **Archived** | any | set | `404 Flag Not Found` |

- Every transition, including self-transitions, writes an Audit Log entry (FR-30).
- `Archived` is terminal in v1: archived flags cannot be restored or edited, and their `key` stays reserved within the environment.

---

## 5. Flag Evaluation Logic & Flow

```mermaid
flowchart TD
  Start([Evaluation Request]) --> AuthCheck{Valid SDK Key?}
  AuthCheck -- No --> R401[Return 401 Unauthorized]
  AuthCheck -- Yes --> FlagCheck{Flag exists and not archived?}
  FlagCheck -- No --> R404[Return 404 Flag Not Found]
  FlagCheck -- Yes --> MasterCheck{isEnabled == true?}

  MasterCheck -- No --> ResDisabled["Return value: false, reason: 'DISABLED'"]
  MasterCheck -- Yes --> RuleLoop[Iterate Targeting Rules]

  RuleLoop --> RuleMatch{Context matches Rule?}
  RuleMatch -- Yes --> ResRule["Return value: rule.value, reason: 'TARGETING_MATCH'"]
  RuleMatch -- No --> HasMoreRules{More Rules?}
  HasMoreRules -- Yes --> RuleLoop

  HasMoreRules -- No --> CheckUserId{userId provided?}
  CheckUserId -- No --> ResNoUser["Return value: false, reason: 'MISSING_USER_ID'"]
  CheckUserId -- Yes --> ComputeHash["bucket = first 4 bytes of SHA256(userId + ':' + flagKey), unsigned big-endian, % 100"]

  ComputeHash --> RolloutCheck{bucket < percentageRollout?}
  RolloutCheck -- Yes --> ResRolloutTrue["Return value: true, reason: 'PERCENTAGE_ROLLOUT'"]
  RolloutCheck -- No --> ResRolloutFalse["Return value: false, reason: 'DEFAULT'"]
```

---

## 6. Data Model (ER-Diagram)

```mermaid
erDiagram
  workspaces {
    uuid id PK
    text name
    timestamptz created_at
  }

  environments {
    uuid id PK
    uuid workspace_id FK
    text name
    text sdk_key_hash UK
    timestamptz created_at
  }

  feature_flags {
    uuid id PK
    uuid environment_id FK
    text key
    text name
    text description
    boolean is_enabled
    integer percentage_rollout
    jsonb targeting_rules
    timestamptz created_at
    timestamptz updated_at
    timestamptz archived_at "NULL = active"
  }

  audit_logs {
    bigint id PK
    uuid environment_id FK
    uuid flag_id FK
    text action
    text actor_id
    jsonb previous_state
    jsonb new_state
    timestamptz performed_at
  }

  workspaces ||--o{ environments : "contains"
  environments ||--o{ feature_flags : "owns"
  environments ||--o{ audit_logs : "logs"
  feature_flags ||--o{ audit_logs : "history"
```

**Constraints:**

- `feature_flags`: `UNIQUE (environment_id, key)` — a flag key is unique within an environment (FR-10).
- `feature_flags.archived_at`: `NULL` for active flags; set on archive (FR-13). Flags are never hard-deleted, so `audit_logs.flag_id` always references an existing row.
- `audit_logs.actor_id`: email of the Workspace Admin who made the change.

---

## 7. Non-Functional Requirements (NFR-xx)

| ID | Category | Requirement |
| :--- | :--- | :--- |
| **NFR-01** | Performance | Evaluation endpoint `POST /api/v1/evaluate` p95 response time shall be < 15 ms under an aggregate load of 500 req/sec on a single-instance Docker deployment. Because of SEC-04, the load is spread across enough SDK keys that no key exceeds its rate limit. |
| **NFR-02** | Determinism | Identical evaluation context (`userId`, `attributes`) and flag configuration shall yield identical results across all service restarts and nodes. |
| **NFR-03** | Availability | Healthcheck endpoints (`GET /healthz`, `GET /readyz`) shall return system readiness status within 5 ms. |
| **NFR-04** | Statelessness | The Evaluation Engine shall not store client context data or mutation state in memory or database during evaluation. |

---

## 8. Security Requirements (SEC-xx)

| ID | Category | Requirement |
| :--- | :--- | :--- |
| **SEC-01** | SDK Key Hashing | SDK keys shall never be stored in plain text. Storage must use SHA-256 hash representations. |
| **SEC-02** | JWT Authentication | Workspace Admin sessions shall use HTTP-only, `SameSite=Lax` JWT cookies with a 12-hour TTL. |
| **SEC-03** | Input Validation | All incoming HTTP request payloads must be validated against Zod schemas. Invalid payloads must return `400 Bad Request` with structured error details. |
| **SEC-04** | Rate Limiting | The evaluation endpoint shall enforce a per-SDK-Key rate limit using a token bucket algorithm. The limit is configurable via `RATE_LIMIT_PER_MINUTE` (default: 1000 requests per minute); requests over the limit return `429 Too Many Requests` with a `Retry-After` header. |

---

## 9. Acceptance Criteria (AC-xx)

### AC-01: Deterministic Percentage Rollout

> **Traces to:** FR-21, NFR-02

- **Given** a flag `new-checkout` with `isEnabled = true`, `percentageRollout = 30%`, and no targeting rules
- **And** `bucket = SHA256("usr_1001:new-checkout") % 100 = 28` (first 4 bytes, unsigned big-endian — see §5)
- **When** the Client API evaluates a context with `userId = "usr_1001"` 100 consecutive times
- **Then** all 100 evaluation responses are identical: `value: true`, `reason: "PERCENTAGE_ROLLOUT"` (because `28 < 30`)
- **And** with `percentageRollout = 28` the same context returns `value: false`, `reason: "DEFAULT"` (boundary: `bucket < percentageRollout` is strict)

### AC-02: Targeting Rule Override

> **Traces to:** FR-21, FR-23

- **Given** a flag `beta-dashboard` with `isEnabled = true` and `percentageRollout = 0%`
- **And** a targeting rule: attribute `plan` `EQUALS` `"enterprise"` → `value: true`
- **When** the Client API evaluates the context `{ "userId": "usr_99", "attributes": { "plan": "enterprise" } }`
- **Then** the response returns `value: true` and `reason: "TARGETING_MATCH"`

### AC-03: Disabled Master Switch

> **Traces to:** FR-21

- **Given** a flag `dark-mode` with `isEnabled = false`, `percentageRollout = 100%`, and matching targeting rules
- **When** the Client API evaluates a context for any user
- **Then** the response returns `value: false` and `reason: "DISABLED"`

---

## 10. Open Questions & Change Log

### Open Questions

| # | Question | Decision |
| :--- | :--- | :--- |
| 1 | Should we support multivariate variations (e.g., strings/JSON payloads) in v1? | **No.** v1 strictly resolves boolean flags (`true`/`false`) to maintain deterministic performance boundaries. |
| 2 | Should evaluation log impression metrics in the DB? | **Non-goal for v1.** Evaluation is 100% side-effect free. |

### Change Log

| Date | Version | Summary of Changes | Author |
| :--- | :--- | :--- | :--- |
| 2026-10-14 | 1.0.0 | Initial SRS draft for FlagForge core engine | Oleksandr Mushynski |
| 2026-10-14 | 1.1.0 | FR-13: soft delete via `archived_at`; §3: single env-configured admin, `actorId` = admin email; §6: `UNIQUE (environment_id, key)` and `archived_at` column | Oleksandr Mushynski |
| 2026-10-14 | 1.2.0 | §4.5: flag lifecycle state machine (Disabled / Enabled / Archived) | Oleksandr Mushynski |
| 2026-10-14 | 1.2.1 | AC-01: state the expected bucket (28) and expected value explicitly; add the strict-boundary case | Oleksandr Mushynski |
| 2026-10-14 | 1.3.0 | SEC-04: rate limit configurable via `RATE_LIMIT_PER_MINUTE` (default 1000/min), `429` + `Retry-After`; NFR-01: 500 req/s is an aggregate load spread across SDK keys | Oleksandr Mushynski |
| 2026-10-14 | 1.3.1 | FR-30: "deleted" → "archived" to match soft delete (v1.1.0); FR-31: list the allowed `action` values | Oleksandr Mushynski |
| 2026-10-14 | 1.3.2 | Review fixes, no behavior change: Glossary matches v1 scope (no users, boolean flags only); §5 and FR-21 define `bucket` precisely (first 4 bytes, unsigned big-endian), as AC-01 references; §6 shows the `feature_flags` → `audit_logs` relation; AC-03 traces to FR-21 only | Oleksandr Mushynski |
| 2026-10-14 | 1.4.0 | §1.1 product goals, §1.2 constraints and §1.3 assumptions stated explicitly (previously spread across the problem definition, design and ADRs); §3.1 use cases UC-01 – UC-06 traced to requirements. No requirement changed | Oleksandr Mushynski |
