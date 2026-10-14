# Execution Plan

Implementation plan for FlagForge v1. Source of truth: [`docs/01-srs.md`](./docs/01-srs.md); architecture: [`docs/02-design.md`](./docs/02-design.md).

## Rules

- Work strictly phase by phase. A phase is **done** when its exit criteria pass.
- After each phase: `pnpm lint` + `pnpm test` → update [`docs/03-validation.md`](./docs/03-validation.md) (matrix status & tests) and [`docs/04-ai-usage.md`](./docs/04-ai-usage.md) → short summary → **stop and wait for approval** (including approval of the listed commits).
- Small Conventional Commits, never squashed. Docs commits come **before** code commits.
- If implementation contradicts the SRS: stop, describe the conflict, propose a change, and after approval commit it as `docs(srs): ...` with a change log entry.
- Test names reference requirement IDs, e.g. `it('FR-21: returns DISABLED when master switch is off')`.

## Progress

| Phase | Name | Status |
| :--- | :--- | :--- |
| 0 | Design artifacts (ADRs, OpenAPI) | ✅ |
| 1 | Monorepo scaffold & CI | ✅ |
| 2 | Evaluation engine (pure domain) | ✅ |
| 3 | Persistence | ✅ |
| 4 | Workspaces, environments & SDK keys | ⬜ |
| 5 | Evaluation API | ⬜ |
| 6 | Auth, flags & audit API | ⬜ |
| 7 | Dashboard | ⬜ |
| 8 | Packaging & demo | ⬜ |
| 9 | Validation & retrospective | ⬜ |

---

## Phase 0 — Design artifacts

**Goal:** finish the contract and decision records before any code.

- `docs/adr/0001` … `0007` — one file per ADR from design §12 (context, options, decision, consequences).
- `docs/api/openapi.yaml` — all endpoints from design §6, schemas, error format, security schemes (`cookieAuth`, `sdkKey`).

**Exit criteria:** OpenAPI file is valid (`npx @redocly/cli lint`), every endpoint references its FR ID in `description`.

**Commits:**
1. `docs(adr): add architecture decision records`
2. `docs(api): add OpenAPI 3.0 contract`

---

## Phase 1 — Monorepo scaffold & CI

**Goal:** an empty but runnable, linted, tested skeleton.

- `pnpm-workspace.yaml`, root `package.json` scripts (`lint`, `typecheck`, `test`, `build`), strict `tsconfig.base.json`.
- `apps/api` — NestJS app with `HealthModule` (`GET /healthz`, `GET /readyz` stub).
- `apps/web` — Vite + React placeholder page.
- `packages/shared` — empty package wired into both apps.
- ESLint + Prettier, Jest in `api` and `shared`.
- `docker-compose.yml` with PostgreSQL 16 only (app container comes in phase 8); `.env.example`.
- `.github/workflows/ci.yml` — install, lint, typecheck, test, build.

**Exit criteria:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass locally; `GET /healthz` returns `200`.

**Commits:**
1. `chore: scaffold pnpm monorepo with api, web and shared packages`
2. `chore: add eslint, prettier and jest configuration`
3. `feat(api): add healthz endpoint`
4. `chore: add docker compose with postgres and env example`
5. `ci: add github actions pipeline`

---

## Phase 2 — Evaluation engine (pure domain)

**Goal:** the core value of the product, fully unit-tested, with no I/O.

- `packages/shared`: Zod schemas for `TargetingRule`, `EvaluationContext`, `EvaluationResult`.
- `apps/api/src/evaluation/engine`: `bucket()`, operators, `evaluate()` (design §5).

**Exit criteria:**
- Unit tests for every branch of FR-21, FR-22, each FR-23 operator, missing-attribute behavior.
- Golden-vector test pinning `bucket()` outputs (NFR-02).
- Distribution test: 10 000 users at 30% → 30% ± 2%.
- Coverage of `engine/` = 100% lines/branches.

**Commits:**
1. `feat(shared): add evaluation and targeting rule schemas`
2. `feat(api): add deterministic sha256 bucketing`
3. `feat(api): add targeting rule operators`
4. `feat(api): add pure flag evaluation engine`

---

## Phase 3 — Persistence

**Goal:** database schema matching SRS §6 v1.1.0.

- Prisma schema + initial migration: tables, `UNIQUE (environment_id, key)`, `UNIQUE (sdk_key_hash)`, `CHECK` on rollout, `archived_at`.
- SQL migration: trigger blocking `UPDATE` / `DELETE` on `audit_logs`.
- `PrismaModule`, `ClockModule` (`SystemClock` + `FakeClock` for tests).

**Exit criteria:** integration tests against Compose Postgres — duplicate flag key rejected, audit row update/delete rejected (FR-30).

**Commits:**
1. `feat(api): add prisma schema and initial migration`
2. `feat(api): enforce audit log immutability with db trigger`
3. `feat(api): add clock abstraction`

---

## Phase 4 — Workspaces, environments & SDK keys

- `WorkspacesModule`: create (with `Development` + `Production` in one transaction), list.
- `EnvironmentsModule`: SDK key generation (`ff_test_` / `ff_live_`), SHA-256 storage, rotation, lookup by hash.
- Routes temporarily unguarded; `AdminGuard` is added in phase 6.

**Exit criteria:** tests for FR-01–FR-05, SEC-01 (raw key never persisted, returned once, old key invalid after rotation).

**Commits:**
1. `feat(api): add workspaces module with default environments`
2. `feat(api): add sdk key generation, hashing and rotation`

---

## Phase 5 — Evaluation API

**Goal:** first end-to-end vertical slice: SDK key → evaluate → result.

- `SdkKeyGuard` (FR-33), `RateLimitGuard` with token bucket on `Clock` (SEC-04).
- Global `ZodValidationPipe` + error filter (SEC-03, design §6.4).
- `POST /api/v1/evaluate` — archived flags → `404`.

**Exit criteria:** e2e tests AC-01, AC-02, AC-03; `400`, `401`, `404`, `429` paths; evaluation performs zero writes (FR-24).

**Commits:**
1. `feat(api): add zod validation pipe and error filter`
2. `feat(api): add sdk key guard`
3. `feat(api): add token bucket rate limiter`
4. `feat(api): add evaluate endpoint`
5. `test(api): add e2e acceptance tests AC-01 to AC-03`

---

## Phase 6 — Auth, flags & audit API

- `AuthModule`: login/logout, JWT cookie (SEC-02), `AdminGuard` on all management routes.
- `FlagsModule`: create, paginated list + search, get, update, archive (FR-10–FR-13).
- `AuditModule`: entry written in the same transaction as each flag mutation; paginated read (FR-30, FR-31).

**Exit criteria:** tests per FR; JWT expiry tested with `FakeClock`; failed mutation leaves no audit row.

**Commits:**
1. `feat(api): add admin jwt authentication`
2. `feat(api): add feature flags crud with archive`
3. `feat(api): add audit logging for flag mutations`

---

## Phase 7 — Dashboard

- Screens from design §9: login, workspaces/environments, flags table with kill-switch, flag editor (rollout slider, rule builder), playground, SDK keys, audit log.
- TanStack Query, forms validated with shared Zod schemas.
- NestJS serves the built SPA.

**Exit criteria:** manual walkthrough of the success-criteria scenario in the browser; component tests for the rule builder.

**Commits:**
1. `feat(web): add login and app shell`
2. `feat(web): add flags list and kill-switch`
3. `feat(web): add flag editor with targeting rules`
4. `feat(web): add evaluation playground`
5. `feat(web): add sdk keys and audit log views`
6. `feat(api): serve dashboard spa`

---

## Phase 8 — Packaging & demo

- Multi-stage `Dockerfile`; app service in `docker-compose.yml` with migrations on start.
- `scripts/demo.sh`: create workspace + flag (50%), evaluate same user N times, assert identical results, report latency.
- `README.md`: overview, quick start, demo, links to docs.

**Exit criteria:** on a clean machine `docker compose up` + `./scripts/demo.sh` pass; p95 < 15 ms (NFR-01).

**Commits:**
1. `build: add multi-stage dockerfile and app service`
2. `feat: add demo script`
3. `docs: add readme`

---

## Phase 9 — Validation & retrospective

- `docs/03-validation.md`: traceability matrix FR/NFR/SEC/AC → test, implemented vs changed, discovered wrong assumptions, technical debt, risks.
- `docs/04-ai-usage.md`: how AI was used, where it helped most, mistakes caught and corrected.
- `docs/05-retrospective.md`: what to change, roadmap for v2.
- Any SRS corrections found during implementation → `docs(srs): ...` with change log entries.

**Commits:**
1. `docs: add validation report and traceability matrix`
2. `docs: add ai usage log`
3. `docs: add retrospective and roadmap`
