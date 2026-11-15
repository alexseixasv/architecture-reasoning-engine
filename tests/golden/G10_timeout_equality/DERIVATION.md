# G10 — Timeout equality boundary

## Hand calculation

`L = 2000` ms, `T = 2000` ms.

`F-LAT-001`: `violated = (L > T) = (2000 > 2000) = false` → metric value `0`.

Because the edge is **not** timed out, retry attempt-rate metrics for that edge must **not** be emitted (healthy path: no amplification metrics).

## Status

`ANSWERED`.
