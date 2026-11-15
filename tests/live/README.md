# Live OpenAI tests

These scripts call the real OpenAI API and **must not** run in ordinary `npm test` or CI.

## Minimal smoke (3 provider calls) — preferred first

```powershell
$env:RUN_LIVE_OPENAI='1'
node --env-file=.env --import tsx scripts/live-smoke.ts
```

Hard cap: **3** OpenAI requests. Fixture: `V01_capacity_sum`. No persistence.

## Full V01–V12 eval (≤34 calls) — requires explicit approval

```powershell
$env:RUN_LIVE_OPENAI='1'
$env:LLM_PROVIDER='openai'
node --env-file=.env --import tsx scripts/live-validation-eval.ts
```

Controls:

- Gate: `RUN_LIVE_OPENAI=1` + `OPENAI_API_KEY`
- Cap: **34** provider requests (12 extract + 12 scenario + ≤10 explain)
- Model: `gpt-4.1` · timeout `60000` · `maxRetries: 0`
- Preflight prints estimated tokens/USD before calls
- Artifact: `artifacts/eval/run-<ISO>.json` (gitignored)
- No persistence; no silent fixture substitution

**Status:** approved baseline + remediation passes executed 2026-11-15 — results recorded in `VALIDATION.md`. Do not re-run without new approval.

Measured baseline estimated API charges: **~$0.186** (published pricing; not invoice). Remediation ~$0.203.

Sanitized summaries for the Evaluation Lab historical panel live under `src/evaluation/historical/*.summary.json` (regenerate with `npm run eval:sanitize-historical` from local gitignored artifacts only — never invent numbers).
