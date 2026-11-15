# Learnings

Discoveries, mistakes, fixes, and reusable patterns. Update after each phase.

## L-001 — Greenfield repo; PDF outside workspace (2026-11-14)

- Hiring PDF was in Downloads, not in the git repo.
- Extracting `TECHNICAL_REQUIREMENTS.md` into version control prevents silent drift from the case and gives stable REQ-IDs for phase gates.
- Pattern: treat external PDFs as inputs; commit a structured extraction, not a binary (unless explicitly requested).

## L-002 — Separate PDF mandates from engineering decisions (2026-11-14)

- Stack choice, analytical engine, no UI, and eight phases are ENG decisions, not PDF mandates.
- Recording them separately avoids claiming the case required choices it only preferred.

## L-003 — exactOptionalPropertyTypes and optional clears (2026-11-14)

- Assigning `fieldConflicts: undefined` fails under `exactOptionalPropertyTypes`.
- Pattern: destructure-omit the property when clearing optional fields in updates/tests.

## L-004 — Semantic warnings must remain persistable (2026-11-14)

- Treating sync cycles / SPOF as persist-blocking ERRORs would prevent storing the very models the interview needs to correct and discuss.
- Split findingClass (`schema` | `referential` | `semantic` | `simulation_readiness`) made the policy testable and explainable.

## L-005 — OCC tests must race, not serialize (2026-11-14)

- A sequential “update then update again with stale version” only proves stale rejection, not mutual exclusion under concurrency.
- Use `Promise.allSettled` on two updates with the same `expectedVersion` and assert exactly one fulfilled + one `VersionConflictError`.

## L-006 — Multiple ingress without split invents load (2026-11-15)

- Applying full `λ'` to each of several ingress nodes double-counts boundary traffic.
- Prefer a single ingress (or gateway) with explicit `requestsPerParent` fan-out; refuse `MULTIPLE_INGRESS_REQUIRES_SPLIT` otherwise.

## L-007 — Standing refusals vs material partials (2026-11-15)

- Always-on refusals (availability %, throughput, E2E, expected attempts) should not alone force `NOT_ANSWERABLE`.
- Filter “standing” reason codes when deriving ANSWERED vs PARTIALLY_ANSWERED from primary metrics.
