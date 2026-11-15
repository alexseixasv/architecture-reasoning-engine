import { describe, expect, it } from 'vitest';
import {
  assertUnderRequestCap,
  checkLiveEvalGate,
  LIVE_EVAL_MAX_PROVIDER_REQUESTS,
} from '../../../src/llm/eval/live-eval-guards';

describe('live eval guards', () => {
  it('requires opt-in gate', () => {
    expect(checkLiveEvalGate({}).ok).toBe(false);
    expect(checkLiveEvalGate({ RUN_LIVE_OPENAI: '1' }).ok).toBe(false);
    expect(
      checkLiveEvalGate({
        RUN_LIVE_OPENAI: '1',
        OPENAI_API_KEY: 'sk-test',
      }).ok,
    ).toBe(true);
  });

  it('enforces request cap of 34', () => {
    expect(LIVE_EVAL_MAX_PROVIDER_REQUESTS).toBe(34);
    expect(() => assertUnderRequestCap(34)).not.toThrow();
    expect(() => assertUnderRequestCap(35)).toThrow(/MAX_PROVIDER_REQUESTS=34/);
  });
});
