# Architecture Decision Records

Each record follows the format: **Context → Options → Decision → Consequences**. Status values: `Proposed`, `Accepted`, `Superseded by ADR-xxxx`.

| ADR | Title | Status |
| :--- | :--- | :--- |
| [0001](./0001-modular-monolith.md) | Modular monolith instead of microservices | Accepted |
| [0002](./0002-jsonb-targeting-rules.md) | Store targeting rules as JSONB | Accepted |
| [0003](./0003-no-cache-layer.md) | No cache layer in v1 | Accepted |
| [0004](./0004-deterministic-rollout.md) | Deterministic rollout via SHA-256 bucketing | Accepted |
| [0005](./0005-in-memory-rate-limiter.md) | In-memory token bucket rate limiter | Accepted |
| [0006](./0006-single-admin.md) | Single env-configured admin | Accepted |
| [0007](./0007-spa-served-by-nestjs.md) | Serve the SPA from the NestJS process | Accepted |
