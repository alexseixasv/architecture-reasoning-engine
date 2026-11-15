import { describe, expect, it } from 'vitest';
import {
  compareScenarioExtraction,
  STRUCTURED_SCENARIO_DENOMINATOR,
  UNSUPPORTED_NL_DENOMINATOR,
} from '../../../src/llm/eval/compare-scenario';

describe('compareScenarioExtraction', () => {
  it('exports dataset denominators', () => {
    expect(STRUCTURED_SCENARIO_DENOMINATOR).toBe(10);
    expect(UNSUPPORTED_NL_DENOMINATOR).toBe(2);
  });

  it('matches load_multiplication parameters', () => {
    const report = compareScenarioExtraction(
      { type: 'load_multiplication', multiplier: 2 },
      {
        status: 'OK',
        scenario: { type: 'load_multiplication', multiplier: 2 },
      },
    );
    expect(report.intentMatch).toBe(true);
    expect(report.parameterMatch).toBe(true);
    expect(report.overallMatch).toBe(true);
  });

  it('separates intent vs parameter mismatch', () => {
    const intentWrong = compareScenarioExtraction(
      { type: 'load_multiplication', multiplier: 1 },
      {
        status: 'OK',
        scenario: {
          type: 'component_unavailable',
          componentId: 'api',
        },
      },
    );
    expect(intentWrong.intentMatch).toBe(false);
    expect(intentWrong.overallMatch).toBe(false);

    const paramWrong = compareScenarioExtraction(
      { type: 'load_multiplication', multiplier: 1 },
      {
        status: 'OK',
        scenario: { type: 'load_multiplication', multiplier: 3 },
      },
    );
    expect(paramWrong.intentMatch).toBe(true);
    expect(paramWrong.parameterMatch).toBe(false);
  });

  it('does not award invented scenarios for unsupported NL', () => {
    const invented = compareScenarioExtraction(null, {
      status: 'OK',
      scenario: { type: 'load_multiplication', multiplier: 1 },
    });
    expect(invented.overallMatch).toBe(false);
    expect(invented.details).toContain('invented_structured_scenario');

    const ok = compareScenarioExtraction(null, {
      status: 'UNSUPPORTED',
      reason: 'no availability model',
    });
    expect(ok.overallMatch).toBe(true);

    const clarify = compareScenarioExtraction(null, {
      status: 'NEEDS_CLARIFICATION',
      reason: 'ambiguous',
      clarificationQuestions: ['which?'],
    });
    expect(clarify.overallMatch).toBe(true);
  });
});
