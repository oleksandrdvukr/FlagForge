# ADR-0003: No cache layer in v1

- **Status:** Accepted
- **Date:** 2026-10-14
- **Related:** NFR-01, NFR-04, Value: kill-switch < 1 s

## Context

The evaluation endpoint must answer with p95 < 15 ms at 500 req/s on a single instance (NFR-01). A kill-switch must take effect in under one second. Each evaluation needs the environment (by SDK key hash) and the flag (by environment + key).

## Options

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. No cache — two indexed point lookups per request** | Always consistent, kill-switch instant, zero invalidation logic | Every request hits Postgres |
| B. In-process cache with invalidation on write | Lowest latency | Invalidation logic, stale reads if a second instance is ever added |
| C. Redis | Shared cache across instances | Extra infrastructure, contradicts ADR-0001 goals |

## Decision

**Option A.** Both lookups use unique B-tree indexes, which Postgres serves in well under 1 ms on a warm pool.

## Consequences

- ✅ Kill-switch is effective on the very next request.
- ✅ No state in the app process apart from the rate limiter (NFR-04).
- ⚠️ DB load grows linearly with evaluation traffic. If the NFR-01 load test (phase 8) fails, Option B is the first fallback and will be proposed as a design change.
