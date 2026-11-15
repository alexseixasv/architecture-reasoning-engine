# G06 — Direct and transitive failure exposure

## Scenario

`component_unavailable` on `postgres`.

## Exposure taxonomy (hand)

- `postgres`: `unavailable`, path `[postgres]`
- `pricing`: direct sync caller → `sync_failure_exposed`, path `[pricing, postgres]`
- `checkout`: sync path length 3 → `sync_transitively_exposed`, path `[checkout, pricing, postgres]`
- `queue`, `invoicing`: no sync path to postgres → `unaffected`

`NO_IMPLIED_FALLBACK`: exposure is **not** proof of outage; absence of modeled fallback is **not** treated as proof that none exists.

## Retry metrics (calling edges into postgres)

Only sync inbound edge: `pricing-postgres`.

- `A_max = 1 + 1 = 2` (`F-RETRY-001`)
- Edge logical load at N=1: `L_checkout=100`, `checkout→pricing` f=1 → 100, `pricing→postgres` f=1 → `λ_e = 100`
- Backoff `none` → `α_max = 100 × 2 = 200` attempts/s (`F-RETRY-002`)

Standing refusals include expected/observed attempts and availability %.

## Status

`ANSWERED` (standing metric refusals only).
