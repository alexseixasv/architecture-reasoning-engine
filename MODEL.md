# MODEL.md — Formal architecture model and deterministic mathematics

**Canonical.** Verified against `src/architecture/domain/schema.ts` and `src/simulation/**` (Phase 8.3).  
**Approach:** closed-form analytical, steady-state, graphs ≤ 15 nodes. No Monte Carlo, discrete-event simulation, or queueing delays beyond utilization/saturation.

The draft at [`docs/engineering/MODEL.md`](docs/engineering/MODEL.md) redirects here.

---

## 1. Formal model structure

| Element | Meaning |
| --- | --- |
| `schemaVersion` | `"1.0.0"` |
| `nodes[]` | `id`, `kind: service\|datastore\|queue`, `name`, optional capacity/replicas/latency/conflicts |
| `dependencies[]` | `id`, `from`, `to`, `communication: sync\|async`, optional timeout/retry/`requestsPerParent` |
| `system` | optional `incomingTraffic`, `availabilityTarget`, `ingressNodeIds` |
| `assumptions[]` / `conflicts[]` | Visible human/model assumptions; document-level contradictions |
| Node `fieldConflicts[]` | Competing quantity candidates for one field (never auto-resolved) |

### Quantities

Discriminated union:

- `known` — `value`, `unit`, `provenance`, optional `note`
- `unknown` — `unit`, optional `reason`

**Units:** `rps | ms | count | percent | ratio`  
**Provenance:** `declared | user_confirmed | assumed | computed`

**Numeric constraints (schema):** replicas ≥ 1 when known; rps/ms ≥ 0; percent 0–100; ratio > 0; general counts ≥ 0 integers.

### Capacity aggregation

`capacityAggregation: sum_replicas | primary_only | unknown`  
Required for defensible capacity when replicas and per-replica capacity exist. Datastore write paths typically need `primary_only`.

### Retry / backoff

`retry.additionalAttempts` + `backoff`:

- `none`
- `fixed { delayMs }`
- `exponential { initialDelayMs, multiplier }`

---

## 2. Validation and conflict semantics

Implemented in `src/architecture/application/validate.ts` (`MAX_NODES = 15`).

| Finding (examples) | Severity | Persist |
| --- | --- | --- |
| Schema / duplicate id / missing refs / graph >15 | ERROR | reject |
| Sync cycle, sync missing timeout, retry without backoff, SPOF | WARNING | allow |
| Missing baseline traffic / capacity | MISSING_INFORMATION | allow |
| Document or field conflicts present | WARNING (`CONTRADICTION_PRESENT`) | allow |

`canPersist` requires no ERROR-class findings. Stored ≠ answerable for every scenario.

---

## 3. Supported scenarios

| `type` | Inputs | Primary outputs |
| --- | --- | --- |
| `load_multiplication` | `multiplier > 0` | Offered load, utilization, saturations |
| `latency_degradation` | `componentId`, `latencyMs ≥ 0` | Timeout violations; retry bounds on timed-out edges |
| `component_unavailable` | `componentId` | Failure-exposure labels + paths; retry bounds on sync inbound edges |

Result status: `ANSWERED | PARTIALLY_ANSWERED | NOT_ANSWERABLE`.

---

## 4. Deterministic formulas (must match code)

### F-CAP-001 — Nominal capacity `C` (rps)

Used by utilization math (`src/simulation/capacity.ts`):

- `sum_replicas`: \(C = R \times c\)
- `primary_only`: \(C = c\)
- `unknown` / missing / conflicted → not answerable

### F-LOAD-001 — Scenario system traffic

\(\lambda' = \lambda_{\text{baseline}} \times N\) → metric `scenario_offered_traffic`

### F-LOAD-INGRESS — Ingress attribution

\(\lambda_{\text{ingress}} = \lambda'\) on the chosen ingress node(s)

Ingress policy:

- Prefer explicit single `system.ingressNodeIds`
- Else exactly one node with no sync inbound → assumption `ASSUME_SINGLE_INGRESS`
- Multiple ingress without declared split → refuse (`MULTIPLE_INGRESS_REQUIRES_SPLIT` / ambiguous)

### F-LOAD-002 — Edge contribution

\(\lambda_e = \lambda_{\text{from}} \times \text{requestsPerParent}\) (both known; never invent `0`)

### F-LOAD-003 — Node accumulation

\(\lambda_v = \sum \lambda_e\) over sync inbound edges with **known** contributions.  
If any sync inbound contribution is missing → refuse exact \(\lambda_v\) (`INCOMPLETE_INBOUND_CONTRIBUTIONS`) and utilization (`DEPENDS_ON_UNKNOWN_OFFERED_LOAD`). Async edges do not contribute. Sync cycles → refuse (`SYNC_CYCLE_LOAD`).

### F-UTIL-001 — Utilization / saturation

\(U = \lambda_v / C\); `saturated = (U \ge 1)` (boolean). Utilization is **not** success ratio.

### F-RETRY-001 — Max attempts per logical request

\(A_{\max} = 1 + \text{additionalAttempts}\) (count). Not expected/observed attempts.

### F-RETRY-002 — Max attempt-rate upper bound

Only when `backoff.type === 'none'` and edge logical load known:

\(\alpha_{\max} = \lambda_e \times A_{\max}\) (unit `attempts_per_s`)

Assumption: immediate retries. **Not** successful throughput.  
Backoff ≠ `none` → refuse rate (`BACKOFF_PREVENTS_INSTANT_RATE`).

### F-LAT-SCENARIO / F-LAT-001 — Latency vs timeout

Scenario sets component latency \(L\). For sync inbound edges to that component with known timeout \(T\):

\(\text{violated} = (L > T)\) (strict; equality is healthy).

---

## 5. Failure exposure (blast radius — qualitative)

Labels from `unavailability.ts` (no Formula ID; **not** a count or availability %):

| Label | Meaning |
| --- | --- |
| `unavailable` | Direct scenario target |
| `sync_failure_exposed` | Direct sync caller of target |
| `sync_transitively_exposed` | Longer sync path exposure |
| `async_dependent` | Async topology relation only |
| `unaffected` | No relevant path |

Assumption `NO_IMPLIED_FALLBACK`: silence does **not** invent failover. Exposure ≠ proven outage count.

`system.availabilityTarget` may be stored from extraction; the engine **never** computes availability % against it.

---

## 6. ASK / ASSUME / REFUSE

| Action | Behavior |
| --- | --- |
| ASK | Completeness recommendations (traffic, capacity, aggregation, conflicts) |
| ASSUME | Only explicit runtime assumptions listed on the result (never silent defaults) |
| REFUSE | `RefusedMetric` with `reasonCode` + message; no plausible fabricated number |

Standing refusals (always present as refused metrics, do not alone force `PARTIALLY_ANSWERED`):  
`availability_percent` (`NO_AVAILABILITY_MODEL`), `throughput` (`NO_THROUGHPUT_MODEL`), `latency_p95_p99` (`NO_LATENCY_DISTRIBUTION`).

Also refused when claimed: expected/observed attempts, invented E2E latency (`E2E_LATENCY_ORDER_UNSPECIFIED`).

---

## 7. Metrics the engine cannot legitimately derive

- Availability / uptime percentages or “nines”
- Successful throughput / completed RPS
- Latency distributions (p95/p99)
- Expected or observed retry counts without failure probabilities / runtime data
- End-to-end latency without a declared path order
- Quantitative “N of M services degraded” blast-radius scores
- Transient backlog / queueing dynamics under steady-state assumption

Prefer a narrow correct engine over a broad inaccurate one (REQ-073).
