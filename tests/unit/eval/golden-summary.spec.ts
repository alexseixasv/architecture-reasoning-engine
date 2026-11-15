import { describe, expect, it } from 'vitest';
import { summarizeGoldenSuite } from '../../eval/golden-summary';

describe('golden suite summary', () => {
  it('passes all G01–G12 with formula and refusal coverage', () => {
    const summary = summarizeGoldenSuite();
    expect(summary.total).toBe(12);
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(12);
    expect(summary.formulaIdsCovered.length).toBeGreaterThan(0);
    expect(
      summary.cases.every((c) => c.passed && c.deterministicRepeatable),
    ).toBe(true);
  });
});
