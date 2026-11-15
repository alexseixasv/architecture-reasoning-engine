# G01 — Capacity aggregation `sum_replicas`

## Independent hand calculation

Given:

- `R = 4` replicas (declared)
- `c = 80` rps per replica (declared)
- `capacityAggregation = sum_replicas`
- Baseline traffic `λ = 80` rps
- Scenario multiplier `N = 1`

Formulas (MODEL.md):

1. `F-CAP-001`: `C = R × c = 4 × 80 = 320` rps
2. `F-LOAD-001`: `λ' = λ × N = 80 × 1 = 80` rps
3. Single ingress `api`: `L_api = λ' = 80` rps (`F-LOAD-INGRESS`)
4. `F-UTIL-001`: `U = L / C = 80 / 320 = 0.25`
5. Saturated iff `U >= 1` → `false`


## Expected numerical metrics (complete set)

| metricId | value | unit | formulaId |
| --- | ---: | --- | --- |
| scenario_offered_traffic | 80 | rps | F-LOAD-001 |
| node_offered_load:api | 80 | rps | F-LOAD-002 |
| utilization:api | 0.25 | ratio | F-UTIL-001 |

## Standing refusals

`NO_AVAILABILITY_MODEL`, `NO_THROUGHPUT_MODEL`, `NO_LATENCY_DISTRIBUTION`.

## Status

`ANSWERED` (only standing fabrication refusals).
