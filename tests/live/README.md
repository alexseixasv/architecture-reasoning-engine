# Live OpenAI tests

These scripts call the real OpenAI API and **must not** run in ordinary `npm test` or CI.

## Minimal smoke (3 provider calls) — preferred first

```powershell
$env:RUN_LIVE_OPENAI='1'
# loads OPENAI_* from .env if you use:
node --env-file=.env --import tsx scripts/live-smoke.ts
# or with key already in the shell:
npm run llm:live-smoke
```

Hard cap: **3** OpenAI requests (extract architecture + extract scenario + explain).  
Fixture: `tests/validation/V01_capacity_sum`. No persistence.

E2E success requires live A=PROPOSED and B=OK; simulation/explanation then use those artifacts.  
If B fails, the script sets `e2eSuccess=false` (exit 3) and may run a clearly labeled independent baseline explain for diagnostics only.

## Full V01–V12 eval (many calls — expensive)

```powershell
$env:RUN_LIVE_OPENAI='1'
npm run llm:live-eval
```

Extraction accuracy remains **NOT MEASURED** until a live run is executed and recorded in `VALIDATION.md`.
