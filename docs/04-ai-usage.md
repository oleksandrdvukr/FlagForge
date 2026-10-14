# AI Usage Log

**Author:** Oleksandr Mushynski  
**Tool:** Claude Code (CLI agent)

This log records how AI was used during the assignment. It is updated after every phase of [`PLAN.md`](../PLAN.md).

---

## 1. Working Model

I own the problem, requirements, architecture, and every decision; AI is used as an accelerator for drafting, formatting, and consistency checks. The process was set up deliberately so that AI cannot act on its own:

| Control | How I enforce it |
| :--- | :--- |
| **Process rules** | I wrote [`CLAUDE.md`](../CLAUDE.md): phase-by-phase execution, stop after each phase, docs before code, SRS as the source of truth, requirement IDs in test names, `Clock` injection, no new technologies without approval. |
| **Commit gate** | Nothing is committed without my explicit approval; I review every diff and commit message. |
| **Requirements gate** | If code contradicts the SRS, AI must stop and propose an SRS change; I decide and it goes through `docs(srs): ...` with a change log entry. |
| **Structure & scope** | I defined the problem, scope, non-goals, the repository structure, and the document set; AI fills them in within those boundaries. |
| **Verification** | AI output is checked by tools (linters, validators, tests) and by my review — not accepted on trust. |

---

## 2. Log by Phase

### Problem & Requirements (`00-problem.md`, `01-srs.md`)

| What I did | How AI was used | Outcome |
| :--- | :--- | :--- |
| Chose the problem (feature flags for safe releases), defined users, value, scope, non-goals, and success criteria. | — | `00-problem.md` |
| Wrote the SRS draft: glossary, actors, FR/NFR/SEC requirements, evaluation flow, data model, acceptance criteria. | Fixed broken Markdown (unclosed code fences, ER diagram rendered as text) and restructured requirements into tables. | SRS v1.0.0 readable on GitHub |
| Reviewed the design and asked for the gaps to be resolved in the SRS. | Cross-checked SRS vs. design and flagged 3 inconsistencies: hard delete vs. immutable audit FK, missing admin identity, flag key uniqueness absent from the ER model. | I chose soft delete, a single env-configured admin, and `UNIQUE (environment_id, key)` → SRS v1.1.0 |
| Decided the SRS should include a flag lifecycle state machine. | Drafted the `Disabled ⇄ Enabled → Archived` diagram and state table for my review. | SRS v1.2.0 |

### Design (`02-design.md`)

| What I did | How AI was used | Outcome |
| :--- | :--- | :--- |
| Set the architecture direction: modular monolith on NestJS + PostgreSQL, no queues/Redis, single-command deployment — and provided the overview section and diagram as the starting point. | Expanded my outline into the full document: module map, evaluation algorithm, API, persistence, security, testing. | `02-design.md` v1.0.0 |
| Defined the target repository structure (pnpm, `docs/adr/`, OpenAPI contract, CI, validation/AI-usage/retrospective docs). | Aligned the design document and plan with my structure. | Stack: pnpm, OpenAPI 3.0, GitHub Actions |
| Approved `@redocly/cli` as the only addition to the stack. | — | Contract lint in CI |

### Phase 0 — ADRs & API Contract

| What I did | How AI was used | Outcome |
| :--- | :--- | :--- |
| Required decisions to be recorded as separate ADRs with alternatives. | Drafted ADR-0001 … 0007 from the design decisions (context, options, consequences). | `docs/adr/` |
| Required a contract-first OpenAPI specification. | Drafted `openapi.yaml`; Redocly caught a schema error (`nullable` without `type`) in the generated file, which was fixed before commit. | Valid OpenAPI 3.0 contract, 0 lint issues |

### Phase 1 — Monorepo Scaffold & CI

| What I did | How AI was used | Outcome |
| :--- | :--- | :--- |
| Defined the monorepo layout (pnpm, `apps/api`, `apps/web`, `packages/shared`) and the phase exit criteria: lint, typecheck, test, build must pass and `/healthz` must answer. | Generated the configuration (TypeScript, ESLint, Prettier, Jest, Vite, Docker Compose, CI) and the health module with e2e tests named after NFR-03. | All checks green locally; Postgres container starts healthy |
| Set the `Clock` rule in `CLAUDE.md` (no `Date.now()` / `new Date()` in domain code). | Turned the rule into an ESLint check so it is enforced automatically, not just by review. | Lint fails on direct system-time access in `apps/api/src` |
| Kept the "no new technologies without approval" gate. | Flagged the only additions — Nest CLI for watch mode (part of NestJS tooling) and `globals` (ESLint config helper). | Stack unchanged in substance |

### Phase 2 — Evaluation Engine

| What I did | How AI was used | Outcome |
| :--- | :--- | :--- |
| Set the exit criteria for the core of the product: every FR-21 – FR-23 branch tested, pinned bucket outputs, a distribution check, and 100% coverage of the engine. | Implemented `bucket()`, the operators and `evaluate()` as pure functions, and wrote 75 tests named after requirement IDs. | 100% line/branch coverage, enforced by a Jest threshold |
| Required that tests prove behaviour, not just execute code. | Golden vectors were computed with an independent implementation (Python `hashlib`), not with the code under test. Two deliberate mutations (`<` → `<=`, swapped hash input) were each caught by the suite. | Tests verified to detect regressions |
| Reviewed the results against the SRS. | Surfaced that AC-01 only holds because `usr_1001` lands in bucket 28 — recorded in the validation report. | Requirement weakness documented instead of hidden |

### Phase 3 — Persistence

| What I did | How AI was used | Outcome |
| :--- | :--- | :--- |
| Decided that audit immutability and data rules must be enforced by the database itself, not only by application code (design §7, ADR-0002). | Wrote the Prisma schema, the initial migration with CHECK constraints, and the immutability trigger migration. | Constraints verified by 14 integration tests on real PostgreSQL |
| Required the `Clock` abstraction from `CLAUDE.md` to be available before any time-dependent code. | Implemented `Clock`, `SystemClock`, `FakeClock`. | Ready for JWT expiry, rate limiting and audit timestamps |
| Reviewed the trigger design. | While testing, found that `TRUNCATE` bypasses row-level triggers and added a statement-level trigger. | Gap closed and recorded in the validation report |
| Kept tool safety guards in place. | When Prisma blocked `migrate reset` for AI agents, the test setup was redesigned around `migrate deploy` with a `_test`-only guard instead of bypassing the protection. | Tests can never reset a non-test database |
| Reviewed the ORM version trade-off and approved Prisma 6 over 7. | Proposed the options: v7 needs a driver adapter and extra config and targets ESM; v6 fits the CommonJS NestJS build. | Decision recorded in design §2 |

### Phase 4 — Workspaces, Environments & SDK Keys

| What I did | How AI was used | Outcome |
| :--- | :--- | :--- |
| Specified the security model for SDK keys in the SRS and design: environment prefixes, SHA-256-only storage, raw key shown once, instant revocation (FR-03 – FR-05, SEC-01). | Implemented key generation (256-bit, `base64url`), hashing, rotation and lookup by hash. | Keys verified never to reach the database or list endpoints |
| Required the workspace and its environments to be created atomically (design §3). | Wrapped creation in one transaction and wrote a test that injects a failure and checks nothing is left behind. | Atomicity proven, not assumed |
| Approved moving the validation pipe from phase 5 to phase 4, where the first request body appears. | Proposed the change and updated `PLAN.md`. | Plan stays accurate |
| Kept time under test control via the `Clock` rule. | e2e tests use `FakeClock`, so `createdAt` values and ordering are asserted exactly. | Deterministic timestamps in tests |

### Phase 5 — Evaluation API

| What I did | How AI was used | Outcome |
| :--- | :--- | :--- |
| Defined the evaluation contract and its order of checks: authenticate → rate-limit → validate → evaluate (FR-20, FR-33, SEC-03, SEC-04). | Implemented the error filter, `SdkKeyGuard`, the token-bucket `RateLimitGuard` on the injected `Clock`, and the endpoint. | First end-to-end vertical slice: SDK key → evaluate → result |
| Required the SRS acceptance criteria to run over real HTTP against a real database. | Wrote AC-01 – AC-03 as e2e tests, including the AC-01 boundary clarified in SRS v1.2.1. | All acceptance criteria green end to end |
| Insisted that FR-24 ("zero writes") be proven, not assumed. | Recorded every database operation during evaluation; verified the check by injecting a write, which the test caught. | FR-24 enforced by a test |
| Kept conflicts between requirements as my decision (per `CLAUDE.md`). | Surfaced that NFR-01 (500 req/s) cannot be load-tested through one key under SEC-04 (1000/min). | Open question recorded for my decision before phase 8 |

---

## 3. Where AI Added the Most Value

1. **Consistency checking** — finding contradictions between SRS, design, and data model before any code was written.
2. **Drafting from a defined structure** — turning my outlines and decisions into complete, uniformly formatted documents (ADRs, OpenAPI).
3. **Mechanical work** — Markdown formatting, tables, diagram syntax.

## 4. Where AI Needed Correction

| Situation | My correction |
| :--- | :--- |
| AI proposed its own repository layout. | Replaced it with the structure I had planned. |
| AI wanted to proceed with commits and the next phase on its own. | Introduced an explicit approval gate for every commit. |
| Generated OpenAPI contained a schema error. | Caught by the Redocly validator I approved for CI. |
| A generated e2e test helper used a default parameter, so "no header" silently sent the header. | Caught by the failing test; the helper was fixed instead of weakening the assertion. |

---

## 5. Principles I Followed

- AI output is a draft until I review it; nothing reaches the repository without my approval.
- Every AI-generated artifact is verified by a tool (validator, linter, tests) where possible.
- I must be able to explain every requirement, decision, and line of code in the repository.
