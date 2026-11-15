# G07 — Timeout boundary and retry attempt upper bound

## Scenario

`latency_degradation` on `pricing` with `L = 3000` ms.

## Hand calculation

- Timeout on `checkout-pricing`: `T = 2000` ms
- `F-LAT-001`: `violated = (3000 > 2000) = true` → metric value `1`
- `A_max = 1 + 3 = 4`
- Edge load at N=1: `λ_e(checkout-pricing) = 50 × 1 = 50`
- Backoff `none` → `α_max = 50 × 4 = 200` attempts/s

E2E latency refused (`E2E_LATENCY_ORDER_UNSPECIFIED`).

## Status

`ANSWERED`.
