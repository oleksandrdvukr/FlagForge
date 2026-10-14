# Retrospective

---

## 1. What I Built

FlagForge v1: a self-hosted feature flag service with deterministic percentage rollouts, attribute targeting, an instant kill-switch and an immutable audit log, shipped as one Docker image plus PostgreSQL.

| | |
| :--- | :--- |
| Path | Problem → SRS → design (ADRs, OpenAPI) → 8 implementation phases → validation |
| Requirements | 29 / 29 implemented and traced to tests; none dropped |
| Tests | 261, green in CI on every push |
| Performance | p95 ≈ 5 ms at 500 req/s (target < 15 ms) |
| SRS | 5 revisions (1.0.0 → 1.3.1), each triggered by something design or implementation revealed |
| History | Small Conventional Commits; documentation commits precede the code they describe |

Details: [validation report](./03-validation.md).

---

## 2. What Worked

**Requirements as the source of truth, with IDs everywhere.** Every test name carries a requirement ID (`FR-21: …`, `SEC-04: …`), so the traceability matrix is a lookup, not an essay. When code and SRS disagreed, the rule in `CLAUDE.md` forced a stop and a `docs(srs): …` commit instead of silent drift — which is why the SRS change log reads like a record of real decisions.

**Validating requirements before code.** Three gaps were found while writing the design, before any implementation: hard delete conflicting with an immutable audit log, no admin identity behind the session requirement, and flag-key uniqueness missing from the data model. Fixing them on paper was cheap; fixing them after phase 6 would not have been.

**Building the core first.** The evaluation engine was built as a pure domain function with 100% test coverage in phase 2, before any database or HTTP layer existed. Everything after that was merely plumbing around an algorithm I had already mathematically and algorithmically validated.

**Guarantees in the database, not only in code.** Audit-log immutability is enforced directly by PostgreSQL triggers, rollout bounds and key formats by CHECK constraints. Testing these DB-level constraints exposed a real edge case: `TRUNCATE` bypasses row-level triggers, which I closed with a statement-level `BEFORE TRUNCATE` trigger.

**Proving tests, not just running them.** Golden vectors for SHA-256 percentage bucketing were computed independently using Python to eliminate bias. Key integration scenarios were stress-tested using fault injection — deliberately removing row locks, injecting unauthorized DB writes, or altering comparison operators to confirm that the test suite actually fails when correctness is violated.

**Phase gates and strict commit control.** Stopping after every phase with lint, unit/e2e tests, a summary review, and my personal approval of each commit kept the Git history clean, readable, and structured. It ensured I retained full ownership of every single line entering the main branch.

### What worked best for me personally

Maintaining strict architectural boundaries and treating the domain core as pure logic. By injecting a `Clock` interface and decoupling evaluation completely from I/O operations, I retained total control over determinism. It allowed me to rigorously reason about edge cases (such as clock skew and concurrent flag edits) before committing to application wiring.

---

## 3. What I Would Do Differently

**Write acceptance criteria with concrete expected values from the start.** AC-01 was initially verified because one particular user ID happened to land in bucket 28. I clarified it in v1.2.1 with explicit seed inputs, but acceptance criteria should be mathematically deterministic from the very first draft.

**Specify concurrency and time in the SRS, not only in the design.** Two critical system behaviors emerged during lower-level technical design rather than initial requirements drafting: concurrent flag edits must preserve sequential audit log ordering, and every time-dependent control (session TTL, rate limits, audit timestamps) must be mockable via an injected clock interface.

**Cross-check non-functional and security requirements against each other earlier.** NFR-01 (500 req/s evaluation benchmark) and SEC-04 (1000 requests per minute per SDK key rate limit) presented a minor friction point during stress testing. A pairwise audit of NFRs versus SEC constraints during Phase 1 would have aligned benchmark execution parameters sooner.

**Choose frontend test tooling in the initial design phase.** Without DOM testing utilities configured in the workspace scaffold, the dashboard relied primarily on domain logic unit tests and manual end-to-end verification. Formally specifying UI testing tools upfront would have provided the frontend with the same automated safety net as the API.

**Plan for operational concerns earlier in the SDLC.** Observability, automated backups, and audit log retention strategies were documented as production risks rather than explicit architectural decisions. Deferring their implementation for v1 was the right scope decision, but documenting their concrete technical path in the initial design doc would have been better engineering practice.

### What I would change in my own process

I would allocate a dedicated phase for systematic threat modeling before writing code. While security requirements were implemented correctly (SHA-256 key hashing, HTTP-only JWTs, input validation), performing a formal STRIDE analysis during the design phase would have made key revocation and rate-limiting bounds even more proactive.

---

## 4. Roadmap for v2

Ordered strictly by risk mitigation and engineering impact:

1. **Server-side SDK with local in-memory cache.** Clients fetch flag configurations and evaluate in-process, refreshed via streaming (SSE) or polling. This removes PostgreSQL and HTTP roundtrips from the hot path — eliminating the single largest production bottleneck — and allows client applications to serve cached values during database outages.
2. **Multi-tenant RBAC & User Identity.** Individual user accounts with granular Admin, Editor, and Viewer roles per workspace, ensuring audit logs map to real human identities rather than a single shared admin account.
3. **Change Safety & Approval Workflows.** Production environment change gates requiring explicit two-person approval or scheduled release windows for high-impact flags.
4. **Multivariate & Dynamic Config Flags.** Support for string, numeric, and complex JSON payload variations beyond boolean toggles (addressing SRS §10, Open Question 1).
5. **Observability & Metrics Pipeline.** Prometheus metrics and structured logging tracking evaluation counts per flag, evaluation latency histograms, rate-limit drops, and stale flag detection.
6. **Distributed Horizontal Scaling.** Shared Redis-backed sliding window rate limiting and pub/sub change invalidation, allowing FlagForge API instances to scale horizontally behind a load balancer.

### The v2 features I consider most important, and why

The Server-side SDK with local caching (Item 1) is paramount. In feature flagging systems, the evaluation engine sits on the critical path of every incoming user request in downstream services. Moving evaluation in-process shifts the architectural profile from $O(\text{network latency})$ to $O(\text{CPU microseconds})$, making the system resilient to infrastructure degradation.

---

## 5. Working With AI

A detailed log of AI tool usage, value generated, and human code corrections is maintained in [`04-ai-usage.md`](./04-ai-usage.md).

In summary: AI operated strictly as a high-speed execution assistant and boilerplate compiler, while I acted as the systems architect, lead engineer, and code reviewer.

I defined the problem domain, authored the SRS requirements, designed the database schema, selected architectural patterns, and verified mathematical correctness. AI tools were tasked with generating initial draft syntax, scaffolding repetitive DTOs, and expanding unit test matrices. Every piece of AI-generated output was systematically reviewed, refactored when non-optimal (such as confirming that the modulo bias of bucketing (~2.3·10⁻⁸) is negligible, and closing a race condition in concurrent audit entries with a row lock), and validated through test suites before entering the repository history.

### My overall takeaway on AI-assisted engineering from this project

AI is an incredible velocity multiplier for drafting code and scaffolding tests, but it lacks architectural judgment, domain empathy, and systemic risk awareness. It will happily propose code that passes naive tests while silently introducing statistical bias, race conditions, or missing transaction boundaries.

True software engineering in an AI-augmented era is not about writing fewer lines of code; it is about taking absolute accountability for system correctness, enforcing strict specification boundaries, and exercising rigorous review over generated artifacts.
