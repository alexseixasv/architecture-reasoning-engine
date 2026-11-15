# G11 — Backoff prevents attempt-rate bound

## Hand reasoning

`L = 5000 > T = 1000` → timeout violated.

`A_max = 1 + 3 = 4` is still answerable (`F-RETRY-001`).

Backoff is `fixed` (not `none`) → refuse steady-state attempt-rate upper bound with `BACKOFF_PREVENTS_INSTANT_RATE`.  
Do **not** emit `max_attempts_for_declared_volume:api-pricing`.

## Status

`PARTIALLY_ANSWERED` (material refusal on attempt-rate metric).
