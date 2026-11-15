# G02 — Datastore `primary_only` capacity

## Independent hand calculation

API:

- `R_api = 2`, `c_api = 100` → `C_api = 2 × 100 = 200` rps (`sum_replicas`)

Postgres:

- `R_db = 3`, `c_db = 50`, `capacityAggregation = primary_only`
- `F-CAP-002`: `C_db = c_db = 50` rps (**not** `3 × 50 = 150`)

Load:

- `λ = 40`, `N = 1` → `λ' = 40`
- `L_api = 40`
- Edge `api → db` with `f = 1` → `contrib = 40 × 1 = 40` → `L_db = 40`

Utilization:

- `U_api = 40 / 200 = 0.2`
- `U_db = 40 / 50 = 0.8`
- Neither saturated (`U ≤ 1`)

## Status

`ANSWERED`.
