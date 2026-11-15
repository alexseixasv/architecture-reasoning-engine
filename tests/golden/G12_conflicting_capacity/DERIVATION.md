# G12 — Conflicting capacity declarations

## Hand reasoning

`pricing.fieldConflicts` includes unresolved `replicas` candidates `{4, 6}`.

Load metrics remain answerable:

- `λ' = 100`
- ingress `λ_pricing = 100`

Utilization / saturation must be refused (`CONFLICTING_CAPACITY_FIELDS`) — engine must not pick a side.

## Status

`PARTIALLY_ANSWERED`.
