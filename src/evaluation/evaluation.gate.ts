export type EvaluationGateResult =
  | { ok: true }
  | { ok: false; code: 'EVAL_LAB_DISABLED'; message: string };

/**
 * Evaluation Lab HTTP endpoints are disabled unless explicitly opted in.
 * Default-off: production and local runs without EVAL_LAB_ENABLED=1 get 403.
 */
export function checkEvaluationLabGate(
  env: NodeJS.ProcessEnv = process.env,
): EvaluationGateResult {
  if (env['EVAL_LAB_ENABLED'] !== '1') {
    return {
      ok: false,
      code: 'EVAL_LAB_DISABLED',
      message:
        'Evaluation Lab is disabled. Set EVAL_LAB_ENABLED=1 in an approved development/demo environment.',
    };
  }
  return { ok: true };
}
