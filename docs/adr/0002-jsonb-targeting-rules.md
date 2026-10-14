# ADR-0002: Store targeting rules as JSONB

- **Status:** Accepted
- **Date:** 2026-10-14
- **Related:** FR-10, FR-21, FR-23, FR-31, SRS §6

## Context

A flag has an ordered list of targeting rules. Rules are always read together with the flag (evaluation, editor) and always written as a whole (FR-12 replaces `targetingRules`). Audit entries store full before/after snapshots.

## Options

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. `feature_flags.targeting_rules jsonb`** | One row read per evaluation, order preserved naturally, snapshot for audit is trivial | Schema enforced in application code (Zod), not by DB |
| B. Normalized `targeting_rules` table | DB-level constraints, queryable per rule | Extra join on the hot path, ordering column, multi-row writes, harder snapshots |

## Decision

**Option A.** The rule shape is validated by a shared Zod schema on every write (SEC-03).

## Consequences

- ✅ Evaluation reads exactly one flag row.
- ✅ `previousState` / `newState` audit snapshots are plain JSON copies.
- ⚠️ No DB-level validation of rule contents; invalid JSON can only enter through direct SQL. Accepted for v1.
- ⚠️ Cross-flag queries like "which flags target `plan`" require JSONB operators. Not needed in v1.
