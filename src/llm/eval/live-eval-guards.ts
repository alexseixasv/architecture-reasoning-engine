export const LIVE_EVAL_MAX_PROVIDER_REQUESTS = 34;

export type LiveEvalGateResult =
  | { ok: true }
  | { ok: false; code: 'NOT_OPTED_IN' | 'MISSING_API_KEY'; message: string };

export function checkLiveEvalGate(
  env: NodeJS.ProcessEnv = process.env,
): LiveEvalGateResult {
  if (env['RUN_LIVE_OPENAI'] !== '1') {
    return {
      ok: false,
      code: 'NOT_OPTED_IN',
      message: 'Refusing to run: set RUN_LIVE_OPENAI=1 to opt in to live OpenAI calls.',
    };
  }
  if (!env['OPENAI_API_KEY']?.trim()) {
    return {
      ok: false,
      code: 'MISSING_API_KEY',
      message: 'OPENAI_API_KEY is required for live evaluation.',
    };
  }
  return { ok: true };
}

export function assertUnderRequestCap(
  started: number,
  max: number = LIVE_EVAL_MAX_PROVIDER_REQUESTS,
): void {
  if (started > max) {
    throw new Error(
      `Live eval aborted: exceeded MAX_PROVIDER_REQUESTS=${max}`,
    );
  }
}
