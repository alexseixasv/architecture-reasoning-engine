# Adversarial suite (Phase 4)

Deterministic boundary tests only. **No LLM extraction or prompt-injection defenses** are implemented in this phase.

| ID | Focus |
| --- | --- |
| ADV-01 | Forced numerical claims in untrusted description text |
| ADV-02 | Unsupported scenario types |
| ADV-03 | Malformed numbers (schema reject) |
| ADV-04 | Contradictory capacity values |
| ADV-05 | Misleading units (schema reject) |
| ADV-06 | Reordered architecture arrays → identical simulate |
| ADV-07 | `NO_IMPLIED_FALLBACK` semantics |
| ADV-08 | Stored NL injection text must not affect `simulate()` |

## Clarification: `NO_IMPLIED_FALLBACK`

Means **no fallback behavior is inferred** from silence in the model.  
It does **not** mean fallback is assumed absent / proven missing.
