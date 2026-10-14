# AI Usage Log

**Author:** Oleksandr Mushynski  
**Tool:** Claude Code (CLI agent)

This log records how AI was used during the assignment. It is updated after every phase of [`PLAN.md`](../PLAN.md).

---

## 1. Working Model

I own the problem, requirements, architecture, and every decision; AI is used as an accelerator for drafting, formatting, and consistency checks. The process was set up deliberately so that AI cannot act on its own:

| Control | How I enforce it |
| :--- | :--- |
| **Process rules** | I wrote [`CLAUDE.md`](../CLAUDE.md): phase-by-phase execution, stop after each phase, docs before code, SRS as the source of truth, requirement IDs in test names, `Clock` injection, no new technologies without approval. |
| **Commit gate** | Nothing is committed without my explicit approval; I review every diff and commit message. |
| **Requirements gate** | If code contradicts the SRS, AI must stop and propose an SRS change; I decide and it goes through `docs(srs): ...` with a change log entry. |
| **Structure & scope** | I defined the problem, scope, non-goals, the repository structure, and the document set; AI fills them in within those boundaries. |
| **Verification** | AI output is checked by tools (linters, validators, tests) and by my review — not accepted on trust. |

---

## 2. Log by Phase

### Problem & Requirements (`00-problem.md`, `01-srs.md`)

| What I did | How AI was used | Outcome |
| :--- | :--- | :--- |
| Chose the problem (feature flags for safe releases), defined users, value, scope, non-goals, and success criteria. | — | `00-problem.md` |
| Wrote the SRS draft: glossary, actors, FR/NFR/SEC requirements, evaluation flow, data model, acceptance criteria. | Fixed broken Markdown (unclosed code fences, ER diagram rendered as text) and restructured requirements into tables. | SRS v1.0.0 readable on GitHub |
| Reviewed the design and asked for the gaps to be resolved in the SRS. | Cross-checked SRS vs. design and flagged 3 inconsistencies: hard delete vs. immutable audit FK, missing admin identity, flag key uniqueness absent from the ER model. | I chose soft delete, a single env-configured admin, and `UNIQUE (environment_id, key)` → SRS v1.1.0 |
| Decided the SRS should include a flag lifecycle state machine. | Drafted the `Disabled ⇄ Enabled → Archived` diagram and state table for my review. | SRS v1.2.0 |

### Design (`02-design.md`)

| What I did | How AI was used | Outcome |
| :--- | :--- | :--- |
| Set the architecture direction: modular monolith on NestJS + PostgreSQL, no queues/Redis, single-command deployment — and provided the overview section and diagram as the starting point. | Expanded my outline into the full document: module map, evaluation algorithm, API, persistence, security, testing. | `02-design.md` v1.0.0 |
| Defined the target repository structure (pnpm, `docs/adr/`, OpenAPI contract, CI, validation/AI-usage/retrospective docs). | Aligned the design document and plan with my structure. | Stack: pnpm, OpenAPI 3.0, GitHub Actions |
| Approved `@redocly/cli` as the only addition to the stack. | — | Contract lint in CI |

### Phase 0 — ADRs & API Contract

| What I did | How AI was used | Outcome |
| :--- | :--- | :--- |
| Required decisions to be recorded as separate ADRs with alternatives. | Drafted ADR-0001 … 0007 from the design decisions (context, options, consequences). | `docs/adr/` |
| Required a contract-first OpenAPI specification. | Drafted `openapi.yaml`; Redocly caught a schema error (`nullable` without `type`) in the generated file, which was fixed before commit. | Valid OpenAPI 3.0 contract, 0 lint issues |

---

## 3. Where AI Added the Most Value

1. **Consistency checking** — finding contradictions between SRS, design, and data model before any code was written.
2. **Drafting from a defined structure** — turning my outlines and decisions into complete, uniformly formatted documents (ADRs, OpenAPI).
3. **Mechanical work** — Markdown formatting, tables, diagram syntax.

## 4. Where AI Needed Correction

| Situation | My correction |
| :--- | :--- |
| AI proposed its own repository layout. | Replaced it with the structure I had planned. |
| AI wanted to proceed with commits and the next phase on its own. | Introduced an explicit approval gate for every commit. |
| Generated OpenAPI contained a schema error. | Caught by the Redocly validator I approved for CI. |

---

## 5. Principles I Followed

- AI output is a draft until I review it; nothing reaches the repository without my approval.
- Every AI-generated artifact is verified by a tool (validator, linter, tests) where possible.
- I must be able to explain every requirement, decision, and line of code in the repository.
