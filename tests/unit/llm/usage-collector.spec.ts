import { describe, expect, it } from 'vitest';
import { UsageCollector } from '../../../src/llm/usage/usage-collector';
import { recordUsage } from '../../../src/llm/usage/usage-recorder';

describe('UsageCollector request isolation', () => {
  it('keeps concurrent collectors independent', async () => {
    const a = new UsageCollector();
    const b = new UsageCollector();

    await Promise.all([
      (async () => {
        for (let i = 0; i < 20; i += 1) {
          recordUsage(
            {
              operation: 'extract_architecture',
              model: 'fake-a',
              inputTokens: 10,
              outputTokens: 1,
              durationMs: 1,
            },
            a,
          );
          await new Promise((r) => setTimeout(r, 0));
        }
      })(),
      (async () => {
        for (let i = 0; i < 20; i += 1) {
          recordUsage(
            {
              operation: 'extract_scenario',
              model: 'fake-b',
              inputTokens: 100,
              outputTokens: 5,
              durationMs: 2,
            },
            b,
          );
          await new Promise((r) => setTimeout(r, 0));
        }
      })(),
    ]);

    const sumA = a.summary();
    const sumB = b.summary();
    expect(sumA.operations).toHaveLength(20);
    expect(sumB.operations).toHaveLength(20);
    expect(sumA.operations.every((o) => o.model === 'fake-a')).toBe(true);
    expect(sumB.operations.every((o) => o.model === 'fake-b')).toBe(true);
    expect(sumA.totals.inputTokens).toBe(200);
    expect(sumB.totals.inputTokens).toBe(2000);
  });
});
