# ADR-0004: Deterministic rollout via SHA-256 bucketing

- **Status:** Accepted
- **Date:** 2026-10-14
- **Related:** FR-21, FR-24, NFR-02, SRS §5

## Context

A percentage rollout must give the same user the same answer on every request, every restart, and every node (NFR-02), without storing assignments (FR-24). Raising the percentage must keep already-included users included.

## Options

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. `sha256(userId + ":" + flagKey)`, first 4 bytes as uint32, `% 100`** | Built into `node:crypto`, stable across platforms and versions, well distributed | Slower than non-cryptographic hashes (still ~1 µs) |
| B. MurmurHash3 / FNV-1a | Faster | Extra dependency or custom code, implementation differences between libraries |
| C. Random assignment stored in DB | Exact percentages | Writes on evaluation (violates FR-24), state to manage |

## Decision

**Option A**, exactly as specified in design §5.3:

```ts
createHash('sha256').update(`${userId}:${flagKey}`, 'utf8').digest().readUInt32BE(0) % 100
```

`bucket < percentageRollout` → included.

## Consequences

- ✅ Monotonic rollouts: going from 30% to 50% only adds users (buckets 30–49).
- ✅ Different flags produce independent buckets for the same user because `flagKey` is part of the input.
- ✅ Golden-vector tests pin the output so accidental changes are caught.
- ⚠️ The algorithm is frozen: changing it reshuffles every user and is a breaking change.
- ⚠️ Modulo bias of `2^32 % 100` (~2.3·10⁻⁸) — negligible.
