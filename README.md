# FlagForge

**Self-hosted feature flags with deterministic percentage rollouts, attribute targeting and an instant kill-switch.**

Deploy code to production dark, roll a feature out to 5% → 50% → 100% of users, and turn it off in under a second if something breaks — without a redeploy. FlagForge is a single Docker image plus PostgreSQL.

- **Deterministic rollouts** — each user lands in one of 100 fixed buckets (`sha256(userId:flagKey)`), so the same user always gets the same answer, and raising the percentage only ever adds users.
- **Targeting rules** — serve a feature to `plan EQUALS enterprise`, `country IN UA,PL`, `seats GREATER_THAN 100`…; the first matching rule wins.
- **Kill-switch** — the master toggle takes effect on the very next evaluation (no caches to expire).
- **Audit log** — every change is recorded with who made it and the full before/after state; entries can't be edited or deleted, even directly in the database.
- **Fast, side-effect-free evaluation** — p95 ≈ 5 ms at 500 req/s on one instance; zero database writes per evaluation.

---

## Quick start

Requirements: Docker with Compose.

```bash
docker compose up -d
```

Open **http://localhost:3000** and sign in with the demo admin:

| Email | Password |
| :--- | :--- |
| `admin@flagforge.local` | `flagforge-demo` |

> These are demo credentials baked into `docker-compose.yml`. Before any real use, set your own `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` and `JWT_SECRET` in a `.env` file (see [Configuration](#configuration)).

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
| `APP_PORT` / `POSTGRES_PORT` | `3000` / `5432` | Host ports |

Generate a password hash:

```bash
docker compose run --rm --no-deps app node -e "console.log(require('bcrypt').hashSync(process.argv[1], 12))" 'your-password'
```

The app validates its configuration at startup and refuses to start with a missing or invalid value.

---

## Development

Requirements: Node 22+, pnpm 10 (`corepack enable`), Docker.

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
| `node scripts/load-test.mjs` | NFR-01 load test: 500 req/s across 40 SDK keys, reports p50/p95/p99 |

Tests reference requirement IDs (`FR-21: …`, `SEC-04: …`), so every requirement can be traced to the tests that prove it — see the [traceability matrix](docs/03-validation.md#1-traceability-matrix).

### Repository layout

```text
apps/api          NestJS: management API, evaluation API, serves the dashboard
apps/web          React + Vite dashboard
packages/shared   Zod schemas and types shared by api and web
docs/             problem, SRS, design, ADRs, OpenAPI, validation, AI usage, retrospective
scripts/          demo.sh, load-test.mjs
```

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
