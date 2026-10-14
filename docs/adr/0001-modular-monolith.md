# ADR-0001: Modular monolith instead of microservices

- **Status:** Accepted
- **Date:** 2026-10-14
- **Related:** NFR-01, Success Criteria (`docker compose up`)

## Context

FlagForge v1 must be self-hostable with a single command and run on one machine. The domain is small: workspaces, environments, flags, audit logs, and one hot read path (`POST /api/v1/evaluate`). The team building v1 is a single engineer.

## Options

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. Modular monolith (NestJS + PostgreSQL)** | One deployable, one DB, in-process calls, simple transactions (flag + audit), trivial local setup | Evaluation and management scale together |
| B. Separate evaluation service + management service | Independent scaling of the hot path | Two deployables, config propagation between services, distributed failure modes |
| C. Serverless functions | No servers to manage | Contradicts self-hosting, cold starts threaten NFR-01 |

## Decision

**Option A.** Module boundaries (`flags`, `evaluation`, `audit`, ...) are enforced inside one NestJS process: modules talk only through exported services.

## Consequences

- ✅ `docker compose up` starts the whole product (app + Postgres).
- ✅ Flag mutation and its audit entry share one DB transaction (FR-30).
- ⚠️ Evaluation cannot be scaled separately. Mitigation: the evaluation module has no dependency on management modules except environment lookup, so it can be extracted later if load requires it.
