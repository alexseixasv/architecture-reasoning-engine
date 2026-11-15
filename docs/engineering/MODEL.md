# MODEL.md — Simulation mathematics (Phase 3 draft)

Closed-form analytical model. Steady-state. Graphs ≤ 15 nodes. No Monte Carlo, DES, or queueing delays.

## Concepts

| Term | Meaning |
| --- | --- |
| Capacity `C` | Max sustained handle rate (rps) from F-CAP-001 |
| Offered load `λ` | Arrival intensity of logical requests (rps) |
| Utilization `U = λ / C` | Offered load over capacity (not success ratio) |
| Throughput | Successful completions — **not computed** |
| Attempt rate | Upper-bound attempts/s under explicit assumptions — **not** successful RPS |
| Saturation | Boolean `U >= 1` |

## Schema additives (Phase 3)

- `dependency.requestsPerParent?: Quantity<'ratio'>` — required for exact edge load
- `system.ingressNodeIds?: string[]` — single ingress for root traffic; multiple without split → refuse

## Formulas

### F-CAP-001 Nominal capacity

- `sum_replicas`: `C = R × c`
- `primary_only`: `C = c`
- `unknown` / missing → refuse

### F-LOAD-001 System scenario traffic

`λ' = λ_baseline × N`

### F-LOAD-002 Edge contribution

`λ_e = λ_from × requestsPerParent` (both known; else omit, never invent 0)

### F-LOAD-003 Node accumulation

`λ_v = Σ λ_e` over all sync inbound edges with known contributions.  
If any sync inbound contribution is missing → refuse exact `λ_v` (`INCOMPLETE_INBOUND_CONTRIBUTIONS`) and also refuse utilization (`DEPENDS_ON_UNKNOWN_OFFERED_LOAD`). Known edge contributions may still be reported individually; they are **not** promoted to a node total.  
Async edges do not contribute. Sync cycles → refuse (`SYNC_CYCLE_LOAD`).

### F-UTIL-001 Utilization / saturation

`U = λ_v / C`; `saturated = (U >= 1)` (boolean classification).

### F-RETRY-001 Max attempts per logical request

`A_max = 1 + additionalAttempts` (count). Not expected/observed attempts.

### F-RETRY-002 Max attempt-rate upper bound

Only when backoff is `none` and edge logical load known and failure/timeout is deterministic for that edge:

`α_max = λ_e × A_max` (unit `attempts_per_s`)

Assumption required: immediate retries. **Not** successful throughput.  
If backoff ≠ `none` → refuse rate (`BACKOFF_PREVENTS_INSTANT_RATE`).

### F-LAT-001 Timeout violation

`violated = (L_scenario > T_edge)` for sync inbound edges to the degraded component.

### Refused always

- End-to-end latency (`E2E_LATENCY_ORDER_UNSPECIFIED`)
- Availability % (`NO_AVAILABILITY_MODEL`)
- Throughput, p95/p99
- Expected / observed attempts

## Failure exposure (not proven outage)

| Label | Meaning |
| --- | --- |
| `unavailable` | Direct scenario target only |
| `sync_failure_exposed` | Direct sync caller of unavailable target |
| `sync_transitively_exposed` | Longer sync path exposure only |
| `async_dependent` | Async topology relation |
| `unaffected` | No relevant path |

No implied fallback absence.

## Ingress

- Explicit single `ingressNodeIds` preferred.
- Else exactly one node without sync inbound → `ASSUME_SINGLE_INGRESS`.
- Else refuse attribution.

## Invalidity conditions

Missing/conflicted quantities, unknown aggregation, missing fan-out, cycles, backoff on rate claims, ambiguous ingress/E2E order.
