# FlagForge

**Self-hosted feature flags with deterministic percentage rollouts, attribute targeting and an instant kill-switch.**

Deploy code to production dark, roll a feature out to 5% → 50% → 100% of users, and turn it off in under a second if something breaks — without a redeploy. FlagForge is a single Docker image plus PostgreSQL.

- **Deterministic rollouts** — each user lands in one of 100 fixed buckets (`sha256(userId:flagKey)`), so the same user always gets the same answer, and raising the percentage only ever adds users.
- **Targeting rules** — serve a feature to `plan EQUALS enterprise`, `country IN UA,PL`, `seats GREATER_THAN 100`…; the first matching rule wins.
- **Kill-switch** — the master toggle takes effect on the very next evaluation (no caches to expire).
- **Audit log** — every change is recorded with who made it and the full before/after state; `UPDATE`, `DELETE` and `TRUNCATE` on the log are rejected by the database itself.
- **Fast, side-effect-free evaluation** — zero database writes per evaluation; p95 ≈ 5 ms at 500 req/s on a single instance ([measured locally](docs/03-validation.md#non-functional-requirements) against the Docker image).
- **Web dashboard** — flags with kill-switch toggles, rule builder, rollout slider drawn as the 100 buckets, an evaluation playground, SDK key rotation and the audit log with per-field diffs.

---

## Quick start

Requirements: Docker with Compose.

```bash
docker compose up -d
```

The first run builds the image (a few minutes). Migrations are applied automatically on start; data lives in the `pgdata` volume (`docker compose down -v` resets it).

Open **http://localhost:3000** and sign in with the demo admin:

| Email | Password |
| :--- | :--- |
| `admin@flagforge.local` | `flagforge-demo` |

> These are demo credentials baked into `docker-compose.yml`. Before any real use, set your own `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` and `JWT_SECRET` in a `.env` file (see [Configuration](#configuration)).

### Load sample flags

With the stack running:

```bash
./scripts/seed.sh
```

It creates the workspace **Acme Store** with flags for each scenario in the SRS — a gradual rollout (`new-checkout`, 30%), a targeted beta (`beta-dashboard`, `plan = enterprise`) and a switched-off flag (`dark-mode`) — checks each one through the evaluation API, and prints both SDK keys **in full**, together with a dashboard link and a ready-to-run `curl`. Paste the Development key into the *Playground* to try the flags in the browser.

If you set your own admin in `.env`, pass the credentials: `ADMIN_EMAIL=… ADMIN_PASSWORD=… ./scripts/seed.sh`.

### Run the demo

With the stack running:

```bash
./scripts/demo.sh
```

It signs in, creates a workspace and a flag with a 50% rollout, then shows that:

1. 100 evaluations of the same user return the identical result, with round-trip latency;
2. ~50% of 200 different users get the feature;
3. turning the flag off applies to the very next evaluation.

Needs only `bash` and `curl`.

### Evaluate a flag from your app

Creating a workspace shows one SDK key per environment (`ff_test_…` for Development, `ff_live_…` for Production) — **once**. Only its hash is stored; if you lose it, rotate it on the *SDK key* page.

For a flag `new-checkout` that is on and has the rule `plan equals enterprise → On`:

```bash
curl -X POST http://localhost:3000/api/v1/evaluate \
  -H "X-Environment-Key: ff_live_..." \
  -H "Content-Type: application/json" \
  -d '{"flagKey":"new-checkout","userId":"usr_1001","attributes":{"plan":"enterprise"}}'
```

```json
{ "flagKey": "new-checkout", "value": true, "reason": "TARGETING_MATCH" }
```

`reason` is one of `DISABLED`, `TARGETING_MATCH`, `PERCENTAGE_ROLLOUT`, `MISSING_USER_ID`, `DEFAULT`. The full contract is in [`docs/api/openapi.yaml`](docs/api/openapi.yaml).

---

## How evaluation works

```text
flag off?               → false, DISABLED
first matching rule?    → rule.value, TARGETING_MATCH
no userId?              → false, MISSING_USER_ID
bucket < rollout %?     → true, PERCENTAGE_ROLLOUT
otherwise               → false, DEFAULT
```

`bucket = first 4 bytes of sha256("<userId>:<flagKey>") as uint32 % 100`. Details: [design §5](docs/02-design.md#5-evaluation-engine-design), [ADR-0004](docs/adr/0004-deterministic-rollout.md).

---

## Architecture

A **modular monolith** ([ADR-0001](docs/adr/0001-modular-monolith.md)): one NestJS process serves the management API, the evaluation API and the built React dashboard ([ADR-0007](docs/adr/0007-spa-served-by-nestjs.md)), backed by PostgreSQL. No Redis, queues or caches in v1 — two indexed reads per evaluation already meet the latency target, and a kill-switch can't be delayed by a stale cache ([ADR-0003](docs/adr/0003-no-cache-layer.md)).

| Layer | Choice |
| :--- | :--- |
| API | Node 24, TypeScript, NestJS 11, Zod validation, JWT session cookie |
| Data | PostgreSQL 16 via Prisma 6; targeting rules as JSONB ([ADR-0002](docs/adr/0002-jsonb-targeting-rules.md)); audit immutability and data rules enforced by triggers and CHECK constraints |
| Evaluation | Pure, I/O-free engine; SHA-256 bucketing ([ADR-0004](docs/adr/0004-deterministic-rollout.md)); in-memory token-bucket rate limit per SDK key ([ADR-0005](docs/adr/0005-in-memory-rate-limiter.md)) |
| Dashboard | React 19, Vite, React Router, TanStack Query |
| Delivery | One Docker image + PostgreSQL via Compose; GitHub Actions CI (lint, OpenAPI contract, typecheck, tests on PostgreSQL, Docker build) |

---

## Configuration

Set these in a `.env` file next to `docker-compose.yml` (copy [`.env.example`](.env.example)).

| Variable | Default (compose) | Description |
| :--- | :--- | :--- |
| `ADMIN_EMAIL` | `admin@flagforge.local` | Admin login |
| `ADMIN_PASSWORD_HASH` | hash of `flagforge-demo` | bcrypt hash of the admin password — wrap in single quotes in `.env` |
| `JWT_SECRET` | demo value | Session signing secret, ≥ 32 characters |
| `COOKIE_SECURE` | `false` | `true` when served over HTTPS (recommended in production) |
| `RATE_LIMIT_PER_MINUTE` | `1000` | Evaluations per minute per SDK key |
| `DATABASE_POOL_SIZE` | `10` | PostgreSQL connection pool size |
| `APP_PORT` / `POSTGRES_PORT` | `3000` / `55432` | Host ports; PostgreSQL is published on `127.0.0.1` only |

Generate a password hash:

```bash
docker compose run --rm --no-deps app node -e "console.log(require('bcrypt').hashSync(process.argv[1], 12))" 'your-password'
```

The app validates its configuration at startup and refuses to start with a missing or invalid value.

---

## Development

Requirements: Node 22.12+ (CI and the image use Node 24), pnpm 10 (`corepack enable`), Docker.

```bash
pnpm install
cp .env.example .env              # demo credentials; change them for real use
docker compose up -d postgres
pnpm --filter @flagforge/api db:deploy
pnpm dev                          # API on :3000, dashboard on :5173 (proxies /api)
```

| Command | What it does |
| :--- | :--- |
| `pnpm test` | Unit, integration and e2e tests (needs the Postgres container; uses a separate `<db>_test` database) |
| `pnpm lint` | ESLint + Prettier |
| `pnpm typecheck` | TypeScript across all packages |
| `pnpm build` | Builds `shared`, `api` and `web` |
| `pnpm lint:api-contract` | Validates the OpenAPI contract |
| `./scripts/seed.sh` | Sample workspace with flags for the SRS scenarios; prints its SDK keys |
| `node scripts/load-test.mjs` | NFR-01 load test: 500 req/s across 40 SDK keys, reports p50/p95/p99 |

Tests reference requirement IDs (`FR-21: …`, `SEC-04: …`), so every requirement can be traced to the tests that prove it — see the [traceability matrix](docs/03-validation.md#1-traceability-matrix).

### Repository layout

```text
apps/api          NestJS: management API, evaluation API, serves the dashboard
apps/web          React + Vite dashboard
packages/shared   Zod schemas and types shared by api and web
docs/             problem, SRS, design, ADRs, OpenAPI, validation, AI usage, retrospective
scripts/          seed.sh, demo.sh, load-test.mjs
```

---

## How it was built

The work followed the SDLC end to end, and the [commit history](https://github.com/oleksandrdvukr/FlagForge/commits/main) shows each step:

1. **Problem** → [00-problem.md](docs/00-problem.md): users, value, scope, non-goals, success criterion.
2. **Requirements** → [01-srs.md](docs/01-srs.md): every requirement has an ID (`FR-xx`, `NFR-xx`, `SEC-xx`) used in test names.
3. **Design** → [02-design.md](docs/02-design.md), [ADRs](docs/adr/README.md), [OpenAPI contract](docs/api/openapi.yaml) — written before any code.
4. **Implementation** in eight gated phases (1 – 8 of [PLAN.md](PLAN.md)): each ended with lint and tests passing, an updated validation report, and a review before commit.
5. **Validation** → [03-validation.md](docs/03-validation.md): 29 / 29 requirements traced to tests. Implementation fed back into the requirements: the SRS went from 1.0.0 to 1.4.0, each change recorded in its change log.
6. **Next iteration** → [05-retrospective.md](docs/05-retrospective.md): what worked, what I would change, the v2 roadmap.

How AI was used, and where it was corrected, is documented in [04-ai-usage.md](docs/04-ai-usage.md).

---

## Documentation

| Document | Contents |
| :--- | :--- |
| [00 — Problem](docs/00-problem.md) | Problem, users, value, scope and non-goals |
| [01 — SRS](docs/01-srs.md) | Requirements (FR / NFR / SEC), state machine, data model, acceptance criteria, change log |
| [02 — Design](docs/02-design.md) | Architecture, modules, evaluation algorithm, API, security, testing |
| [ADRs](docs/adr/README.md) | Key decisions with the alternatives considered |
| [OpenAPI](docs/api/openapi.yaml) | API contract |
| [03 — Validation](docs/03-validation.md) | Traceability matrix, requirement changes, technical debt, risks |
| [04 — AI usage](docs/04-ai-usage.md) | How AI was used and where it was corrected |
| [05 — Retrospective](docs/05-retrospective.md) | What worked, what I would change, roadmap for v2 |
| [Plan](PLAN.md) | Phase-by-phase execution plan |

---

## Status

v1 is a working first iteration. Intentionally out of scope: multi-user roles, webhooks/integrations, A/B statistics, scheduled toggles, edge evaluation ([non-goals](docs/00-problem.md#non-goals-v1)). Known shortcuts and production risks are listed in [validation §5–6](docs/03-validation.md#5-technical-debt-accepted-shortcuts).
