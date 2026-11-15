# G05 — Shared downstream accumulation

## Topology

Single ingress `gateway` (`λ = 50`, `N = 1`).

Declared fan-out:

- `gateway → orders` with `f = 2` → `50 × 2 = 100`
- `gateway → catalog` with `f = 1` → `50 × 1 = 50`
- `orders → inventory` with `f = 1` → `100`
- `catalog → inventory` with `f = 1` → `50`

## Independent hand calculation

`F-LOAD-003` at Inventory: `λ_inventory = 100 + 50 = 150` rps

Capacities:

- `C_gateway = 2 × 200 = 400` → `U = 50/400 = 0.125`
- `C_orders = 4 × 100 = 400` → `U = 100/400 = 0.25`
- `C_catalog = 4 × 100 = 400` → `U = 50/400 = 0.125`
- `C_inventory = 2 × 100 = 200` → `U = 150/200 = 0.75`

None saturated (`U < 1`).

## Status

`ANSWERED`.
