# G04 — Load multiplication with Pricing saturation

## Explicit propagation model

- **Ingress node:** `checkout` (`system.ingressNodeIds = ["checkout"]`)
- **Dependency:** `checkout → pricing` with `requestsPerParent = 1` (declared)

## Independent hand calculation

Baseline: `λ = 200` rps, multiplier `N = 3`.

1. `F-LOAD-001`: `λ' = 200 × 3 = 600` rps
2. Ingress assignment: `L_checkout = 600` rps (`F-LOAD-INGRESS`)
3. Fan-out contribution: `λ_e(checkout-pricing) = L_checkout × 1 = 600` rps (`F-LOAD-002`)
4. Accumulation: `L_pricing = 600` rps (`F-LOAD-003`)  
   Therefore **600 RPS reaches Pricing** via declared `requestsPerParent = 1` (not implicit).
5. Checkout capacity: `C_checkout = 10 × 100 = 1000` rps → `U_checkout = 600/1000 = 0.6` → not saturated
6. Pricing capacity: `C_pricing = 4 × 80 = 320` rps
7. Pricing utilization: `U_pricing = 600 / 320 = 1.875`
8. Saturated: `1.875 >= 1` → **`saturated = true`**


## Status

`ANSWERED`.
