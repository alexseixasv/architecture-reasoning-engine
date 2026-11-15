import { describe, expect, it } from 'vitest';
import { excerptAppearsInSource } from '../../../src/llm/mapping/provenance';

describe('provenance excerpt verification', () => {
  it('requires exact contiguous substring', () => {
    const source = 'API has 4 replicas and 80 rps capacity.';
    expect(excerptAppearsInSource(source, '4 replicas')).toBe(true);
    expect(excerptAppearsInSource(source, '5 replicas')).toBe(false);
    expect(excerptAppearsInSource(source, '')).toBe(false);
  });

  it('normalizes newlines only', () => {
    expect(
      excerptAppearsInSource('line1\r\nline2', 'line1\nline2'),
    ).toBe(true);
  });
});
