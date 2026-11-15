# LIVE_CHANGES.md — Interview live-coding readiness

**Do not implement these unless the panel asks.** Prepare to execute under observation (~10–20 minutes each). Prefer small, testable diffs that respect the LLM/engine boundary.

---

## Change A — Standing refusal copy / reason enrichment

### Expected requirement
Make the standing `availability_percent` refusal message explicitly mention that `system.availabilityTarget` is ignored (documentation + reason text), without computing any %.

### Relevant files
- `src/simulation/simulate.ts` (or wherever `alwaysRefuseFabrications` is built)
- `MODEL.md` / golden expected refusal messages if asserted strictly
- Unit test under `tests/unit/simulation/` or golden that checks reason codes

### Approach
1. Locate standing refusals emitted for every simulate.
2. Adjust **message string** only (keep `reasonCode: NO_AVAILABILITY_MODEL`).
3. Update any golden/adversarial assertion that matches full message text.
4. Do **not** add an availability formula.

### Tests
- Existing golden suite still green.
- One focused unit asserting reasonCode unchanged + new substring.

### Risks / tradeoffs
Message churn vs golden coupling; must not imply a computed target comparison.

### Time
~10–15 minutes.

---

## Change B — Frontend: disable Analyze until version is selected

### Expected requirement
If multiple versions exist and the user cleared selection somehow, or to be stricter: require an explicit selected version badge before Analyze (already mostly gated — tighten UX copy or disable when `version === null` after failed load).

### Relevant files
- `frontend/src/composables/useAnalysis.ts`
- `frontend/src/components/ScenarioPanel.vue`
- `frontend/tests/workspace.spec.ts` or `versioning.spec.ts`

### Approach
1. Confirm `canAnalyze` already requires `architectureId` + `version`.
2. Improve empty-state copy: “Select or persist a version.”
3. Add a Vitest case: no analyze call when version null.

### Tests
Frontend Vitest only (mocked client). No backend change.

### Risks / tradeoffs
Over-blocking if version temporarily null during load — keep loading state clear.

### Time
~10 minutes.

---

## Change C — Validation finding: warn when `availabilityTarget` is known but unused

### Expected requirement
When `system.availabilityTarget` is `known`, emit a MISSING_INFORMATION or WARNING finding that the engine will not use it for availability % (honest surfacing of REQ-003 gap).

### Relevant files
- `src/architecture/application/validate.ts`
- `src/architecture/domain/findings.ts` (new code constant)
- `tests/unit/architecture/validate.spec.ts`
- Optionally `MODEL.md` one-line note

### Approach
1. Add finding code e.g. `AVAILABILITY_TARGET_UNUSED`.
2. Trigger when quantity state is known.
3. Severity WARNING or MISSING_INFORMATION with `persistenceEffect: allow`.
4. Unit test with fixture target set.

### Tests
`validate.spec.ts` + ensure persist still allowed.

### Risks / tradeoffs
Noise on every document that declares a target; keep message educational, not blocking.

### Time
~15–20 minutes.

---

## Prep checklist before the session

- [ ] `docker compose up -d --build` healthy; SPA on `:8080`
- [ ] IDE indexed; jump to `simulate.ts`, `validate.ts`, `useArchitectureSession.ts`
- [ ] `npm test` and `cd frontend && npm test` known green
- [ ] Refuse any request to “just make the LLM return utilization”
