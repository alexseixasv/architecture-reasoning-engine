import { afterEach, describe, expect, it } from 'vitest';
import { checkEvaluationLabGate } from '../../../src/evaluation/evaluation.gate';

describe('checkEvaluationLabGate', () => {
  const original = process.env['EVAL_LAB_ENABLED'];

  afterEach(() => {
    if (original === undefined) {
      delete process.env['EVAL_LAB_ENABLED'];
    } else {
      process.env['EVAL_LAB_ENABLED'] = original;
    }
  });

  it('disables by default', () => {
    delete process.env['EVAL_LAB_ENABLED'];
    const gate = checkEvaluationLabGate();
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.code).toBe('EVAL_LAB_DISABLED');
    }
  });

  it('disables when set to 0', () => {
    const gate = checkEvaluationLabGate({ EVAL_LAB_ENABLED: '0' });
    expect(gate.ok).toBe(false);
  });

  it('enables only when EVAL_LAB_ENABLED=1', () => {
    const gate = checkEvaluationLabGate({ EVAL_LAB_ENABLED: '1' });
    expect(gate.ok).toBe(true);
  });
});
