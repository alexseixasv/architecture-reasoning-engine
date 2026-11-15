import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { EvaluationController } from '../../../src/evaluation/evaluation.controller';
import { EvaluationService } from '../../../src/evaluation/evaluation.service';
import { HistoricalEvidenceService } from '../../../src/evaluation/historical/historical.service';

describe('EvaluationController', () => {
  const original = process.env['EVAL_LAB_ENABLED'];
  const evaluation = new EvaluationService();
  const historical = new HistoricalEvidenceService();
  const controller = new EvaluationController(evaluation, historical);

  afterEach(() => {
    if (original === undefined) {
      delete process.env['EVAL_LAB_ENABLED'];
    } else {
      process.env['EVAL_LAB_ENABLED'] = original;
    }
  });

  it('returns 403 when lab disabled', () => {
    delete process.env['EVAL_LAB_ENABLED'];
    expect(() => controller.listSuites()).toThrow(ForbiddenException);
    expect(() => controller.run({ suiteId: 'golden' })).toThrow(
      ForbiddenException,
    );
    expect(() => controller.getHistorical()).toThrow(ForbiddenException);
  });

  it('lists suites when enabled', () => {
    process.env['EVAL_LAB_ENABLED'] = '1';
    const result = controller.listSuites();
    expect(result.suites.some((s) => s.id === 'deterministic_full')).toBe(
      true,
    );
    expect(
      result.suites.every((s) => s.requiresOpenAi === false),
    ).toBe(true);
  });

  it('rejects invalid suiteId', () => {
    process.env['EVAL_LAB_ENABLED'] = '1';
    expect(() => controller.run({ suiteId: 'not-a-suite' })).toThrow(
      BadRequestException,
    );
  });

  it('runs golden suite when enabled', () => {
    process.env['EVAL_LAB_ENABLED'] = '1';
    const result = controller.run({ suiteId: 'golden' });
    expect(result.summary.total).toBe(12);
    expect(result.summary.failed).toBe(0);
  });

  it('returns historical with required disclaimer', () => {
    process.env['EVAL_LAB_ENABLED'] = '1';
    const result = controller.getHistorical();
    expect(result.disclaimer).toBe(
      'Historical OpenAI evaluation — not executed in this run',
    );
    expect(result.artifacts.length).toBeGreaterThanOrEqual(2);
    for (const art of result.artifacts) {
      expect(art.disclaimer).toBe(result.disclaimer);
      expect(art.metrics.fieldAccuracy.total).toBeGreaterThan(0);
      expect(art.cases.length).toBe(12);
    }
  });
});
