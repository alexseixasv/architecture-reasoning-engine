import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { EvaluationService } from '../../../src/evaluation/evaluation.service';
import * as goldenAdapter from '../../../src/evaluation/adapters/golden.adapter';
import type { EvaluationCaseResult } from '../../../src/evaluation/types';

describe('EvaluationService', () => {
  it('runs deterministic_full with correct summary aggregation', () => {
    const service = new EvaluationService();
    const result = service.runSuite('deterministic_full');

    expect(result.runId).toMatch(/^evr_/);
    expect(result.suiteId).toBe('deterministic_full');
    expect(result.summary.total).toBe(32);
    expect(
      result.summary.passed + result.summary.failed + result.summary.skipped,
    ).toBe(32);
    expect(result.summary.passed).toBe(32);
    expect(result.summary.failed).toBe(0);
    expect(result.overallStatus).toBe('passed');
    expect(result.suites).toHaveLength(3);

    const bySuite = Object.fromEntries(
      result.suites.map((s) => [s.suiteId, s.cases.length]),
    );
    expect(bySuite).toEqual({
      golden: 12,
      validation_formal: 12,
      adversarial: 8,
    });

    const v10 = result.suites
      .flatMap((s) => s.cases)
      .find((c) => c.caseId === 'V10');
    expect(v10?.checkKind).toBe('schema_validation');
    expect(v10?.verifies).toMatch(/Does NOT claim NL scenario classification/i);

    const adv08 = result.suites
      .flatMap((s) => s.cases)
      .find((c) => c.caseId === 'ADV-08');
    expect(adv08?.checkKind).toBe('nl_isolation_check');
    expect(adv08?.verifies).toMatch(/does NOT prove LLM prompt-injection/i);
  });

  it('runs golden suite alone', () => {
    const service = new EvaluationService();
    const result = service.runSuite('golden');
    expect(result.summary.total).toBe(12);
    expect(result.summary.failed).toBe(0);
    expect(result.suites).toHaveLength(1);
  });

  it('isolates a failing case without aborting the suite', () => {
    const real = goldenAdapter.runGoldenCase;
    const failSpy = vi
      .spyOn(goldenAdapter, 'runGoldenCase')
      .mockImplementation((caseId: string): EvaluationCaseResult => {
        if (caseId === 'G03') {
          return {
            caseId: 'G03',
            suiteId: 'golden',
            checkKind: 'simulation_correctness',
            description: 'forced fail',
            verifies: 'test',
            executedAt: new Date().toISOString(),
            status: 'failed',
            durationMs: 1,
            expectedOutcome: null,
            actualOutcome: null,
            mismatches: [
              {
                path: 'forced',
                expected: true,
                actual: false,
                message: 'deliberate fail',
              },
            ],
            evidence: {},
            failureReason: 'deliberate fail',
            input: null,
          };
        }
        return real(caseId);
      });

    try {
      const service = new EvaluationService();
      const result = service.runSuite('golden');
      expect(result.summary.total).toBe(12);
      expect(result.summary.failed).toBe(1);
      expect(result.summary.passed).toBe(11);
      expect(result.overallStatus).toBe('failed');
      expect(
        result.suites[0]?.cases.find((c) => c.caseId === 'G03')?.status,
      ).toBe('failed');
      expect(
        result.suites[0]?.cases.find((c) => c.caseId === 'G01')?.status,
      ).toBe('passed');
    } finally {
      failSpy.mockRestore();
    }
  });

  it('does not import OpenAI provider modules', () => {
    const files = [
      'evaluation.service.ts',
      'catalog.ts',
      'evaluation.controller.ts',
      'adapters/golden.adapter.ts',
      'adapters/validation.adapter.ts',
      'adapters/adversarial.adapter.ts',
    ];
    for (const rel of files) {
      const text = readFileSync(
        join(process.cwd(), 'src', 'evaluation', rel),
        'utf8',
      );
      expect(text).not.toMatch(/from ['"]openai['"]/);
      expect(text).not.toMatch(/from ['"]node:child_process['"]/);
      expect(text).not.toMatch(/from ['"]child_process['"]/);
      expect(text).not.toMatch(/LlmProvider/);
      expect(text).not.toMatch(/extractArchitecture/);
      expect(text).not.toMatch(/RUN_LIVE_OPENAI/);
    }
  });
});
