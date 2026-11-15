import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  resolveSuiteRunners,
  runSuiteCases,
  SUITE_DESCRIPTORS,
} from './catalog';
import type {
  EvaluationRunResult,
  EvaluationSuiteId,
  EvaluationSuiteSummary,
} from './types';

/**
 * Sequential deterministic evaluation runner.
 * No OpenAI, no shell, no DB writes, no child_process.
 *
 * Note: per-case wall timing uses performance.now(). Synchronous CPU-bound
 * work cannot be forcibly interrupted by Promise.race; suite size is fixed
 * and fixtures are tiny, so hard CPU preemption is unnecessary.
 */
@Injectable()
export class EvaluationService {
  listSuites() {
    return { suites: SUITE_DESCRIPTORS };
  }

  runSuite(suiteId: EvaluationSuiteId): EvaluationRunResult {
    const executedAt = new Date().toISOString();
    const runStarted = performance.now();
    const runners = resolveSuiteRunners(suiteId);
    const suites: EvaluationSuiteSummary[] = [];

    // Sequential execution — measured suite is small; concurrency not justified.
    for (const runnerId of runners) {
      const suiteStarted = performance.now();
      const cases = runSuiteCases(runnerId);
      const durationMs =
        Math.round((performance.now() - suiteStarted) * 1000) / 1000;
      suites.push({
        suiteId: runnerId,
        passed: cases.filter((c) => c.status === 'passed').length,
        failed: cases.filter((c) => c.status === 'failed').length,
        skipped: cases.filter((c) => c.status === 'skipped').length,
        durationMs,
        cases,
      });
    }

    const allCases = suites.flatMap((s) => s.cases);
    const summary = {
      total: allCases.length,
      passed: allCases.filter((c) => c.status === 'passed').length,
      failed: allCases.filter((c) => c.status === 'failed').length,
      skipped: allCases.filter((c) => c.status === 'skipped').length,
      durationMs: Math.round((performance.now() - runStarted) * 1000) / 1000,
    };

    return {
      runId: `evr_${randomUUID()}`,
      executedAt,
      suiteId,
      overallStatus: summary.failed === 0 ? 'passed' : 'failed',
      summary,
      suites,
    };
  }
}
