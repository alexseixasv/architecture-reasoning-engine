# NOT_DONE.md — Honest omissions

**Page-size assumption:** one manuscript page ≈ 450–500 words. This file is intentionally ≤1 page.

## Intentionally excluded (PDF OUT_OF_SCOPE)

Authentication, multi-tenancy, diagram rendering/input, Kubernetes manifests, CI/CD as a submission deliverable. No productized auth or tenant isolation.

## Intentionally unsupported math

Availability % vs target; successful throughput; p95/p99; Monte Carlo / discrete-event; queueing beyond utilization/saturation; quantitative “N of M degraded” blast-radius scores. The engine **refuses** these rather than inventing them (`MODEL.md`).

## Incomplete / partial behavior

- **REQ-003 shape:** timeout, saturation, retry upper bounds, and qualitative failure exposure are implemented; availability % and numeric blast radius are not.
- **ASK/ASSUME/REFUSE:** ASSUME is never silently recommended by completeness; only explicit runtime assumptions appear.
- **Observability:** per-request `timingsMs` + token/usage JSON — **no** OpenTelemetry collector/export.
- **Scenario live scoring** used formal architecture context, not extracted documents — full extract→scenario accuracy **not measured**.

## Known extraction limitations (measured)

On the fixed V01–V12 OpenAI set (remediation pass): field accuracy **141/244 (57.8%)** directional (denominator shifted vs baseline); Node F1 **0.86**, Dep F1 **0.84**; residual **DTO omissions** and ID slug extras; explain fallback **1/10** (V07). Fake LLM demos prove wiring, **not** generalization to panel-unseen prose.

## Missing production hardening

No authz, rate limiting, multi-tenant isolation, HA Postgres, horizontal scale story, paid-provider spend guards beyond opt-in gates, or CI pipeline. OCC handles concurrent edits; it does not merge.

## Delivered transparency (not a gap)

Evaluation Lab (Phase 9) re-runs allowlisted deterministic G/V/ADV cases and surfaces historical OpenAI summaries — it does **not** close the extraction-generalization gap above.

## Future iteration priorities

1. Reduce extraction omissions (ids + quantities) without hardcoding fixtures.  
2. Measure extract→scenario end-to-end on a held-out set.  
3. Optional OTel export.  
4. Richer exposure metrics **only** with defensible definitions.
