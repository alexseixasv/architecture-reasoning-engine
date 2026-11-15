# G09 — Unknown inbound contributions

## Setup

`b-shared` intentionally omits `requestsPerParent`.

## Hand reasoning

Known path:

- `λ' = 40`
- `λ_a = 40`, `λ_e(a-shared) = 40`

Missing:

- `edge_offered_load:b-shared` refused (`MISSING_REQUESTS_PER_PARENT`) — not invented as 0
- Exact `λ_shared` refused (`INCOMPLETE_INBOUND_CONTRIBUTIONS`)
- `utilization:shared` refused (`DEPENDS_ON_UNKNOWN_OFFERED_LOAD`)
- Known partial contribution `a-shared=40` must **not** be promoted to node total

## Status

`PARTIALLY_ANSWERED`.
