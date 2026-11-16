import { describe, expect, it } from 'vitest';
import { peelTrailingQuestion } from '@/lib/peelQuestion';

describe('peelTrailingQuestion', () => {
  it('moves a trailing latency question out of architecture prose', () => {
    const blob = [
      'Checkout runs 6 replicas, pricing 4, each handling 80 rps.',
      '',
      "Let's suppose my PostgreSQL starts growing up the latency for 2s, what could happen to my architecture?",
    ].join('\n');

    const peeled = peelTrailingQuestion(blob);
    expect(peeled.architecture).toContain('Checkout runs 6 replicas');
    expect(peeled.architecture).not.toContain('PostgreSQL');
    expect(peeled.question).toMatch(/PostgreSQL starts growing up the latency/i);
  });
});
