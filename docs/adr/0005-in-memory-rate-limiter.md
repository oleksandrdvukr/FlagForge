# ADR-0005: In-memory token bucket rate limiter

- **Status:** Accepted
- **Date:** 2026-10-14
- **Related:** SEC-04, NFR-04

## Context

The evaluation endpoint must be limited to 1000 requests per minute per SDK key (SEC-04). v1 runs as a single instance (ADR-0001).

## Options

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. In-memory token bucket keyed by environment** | No infrastructure, O(1) per request, testable with a fake `Clock` | Limits are per process; reset on restart |
| B. Postgres counter | Survives restarts | A write on every evaluation (violates FR-24) |
| C. Redis | Shared across instances | Extra infrastructure |
| D. `@nestjs/throttler` | Ready-made | Fixed-window by default, not keyed by SDK key without customization, adds a dependency |

## Decision

**Option A.** Capacity `RATE_LIMIT_PER_MINUTE` tokens (default 1000), refill `RATE_LIMIT_PER_MINUTE / 60` tokens per second, time taken from the injected `Clock`. Exceeding the limit returns `429` with `Retry-After`.

**Amendment (SRS v1.3.0):** the limit was made configurable. A single backend service evaluating a flag per request can legitimately exceed 1000/min, so operators tune it per deployment while the default stays conservative.

## Consequences

- ✅ Zero DB writes on the hot path.
- ⚠️ The bucket map is the only in-memory state; it holds counters, not client context, so NFR-04 is respected.
- ⚠️ Horizontal scaling would multiply the effective limit by the number of instances. Must be revisited together with ADR-0001 and ADR-0003.
