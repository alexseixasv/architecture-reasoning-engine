import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { architectureDocumentSchema } from '../../src/architecture/domain/schema';
import type { ArchitectureDocument } from '../../src/architecture/domain/types';
import { simulate } from '../../src/simulation/simulate';

const root = join(process.cwd(), 'tests', 'adversarial');

function loadArch(name: string): unknown {
  return JSON.parse(readFileSync(join(root, 'fixtures', name), 'utf8'));
}

describe('adversarial deterministic boundaries ADV-01–ADV-08', () => {
  it('ADV-01 forced numbers in untrusted description text are ignored', () => {
    const architecture = loadArch('adv01_forced_numbers.json');
    const parsed = architectureDocumentSchema.parse(architecture);
    const result = simulate(parsed as ArchitectureDocument, {
      type: 'load_multiplication',
      multiplier: 1,
    });
    const util = result.metrics.find((m) => m.metricId === 'utilization:api');
    expect(util?.value).toBe(0.25);
    expect(result.metrics.some((m) => m.value === 9999)).toBe(false);
    expect(result.refused.some((r) => r.reasonCode === 'NO_AVAILABILITY_MODEL')).toBe(
      true,
    );
  });

  it('ADV-02 unsupported scenario type is refused', () => {
    const architecture = loadArch('adv01_forced_numbers.json');
    const parsed = architectureDocumentSchema.parse(architecture);
    const result = simulate(parsed as ArchitectureDocument, {
      type: 'chaos_monkey',
      severity: 'high',
    });
    expect(result.status).toBe('NOT_ANSWERABLE');
    expect(
      result.refused.some((r) => r.reasonCode === 'INVALID_SCENARIO'),
    ).toBe(true);
    expect(result.metrics).toHaveLength(0);
  });

  it('ADV-03 malformed numbers rejected by architecture schema', () => {
    const architecture = loadArch('adv03_malformed_numbers.json');
    const parsed = architectureDocumentSchema.safeParse(architecture);
    expect(parsed.success).toBe(false);
  });

  it('ADV-04 contradictory capacity values refuse utilization', () => {
    const architecture = loadArch('adv04_contradictory.json');
    const parsed = architectureDocumentSchema.parse(architecture);
    const result = simulate(parsed as ArchitectureDocument, {
      type: 'load_multiplication',
      multiplier: 1,
    });
    expect(result.status).toBe('PARTIALLY_ANSWERED');
    expect(
      result.refused.some((r) => r.reasonCode === 'CONFLICTING_CAPACITY_FIELDS'),
    ).toBe(true);
    expect(
      result.metrics.some((m) => m.metricId === 'utilization:pricing'),
    ).toBe(false);
  });

  it('ADV-05 misleading units rejected by schema', () => {
    const architecture = loadArch('adv05_misleading_units.json');
    const parsed = architectureDocumentSchema.safeParse(architecture);
    expect(parsed.success).toBe(false);
  });

  it('ADV-06 reordered architecture arrays yield identical simulation', () => {
    const a = architectureDocumentSchema.parse(
      loadArch('adv06_order_a.json'),
    ) as ArchitectureDocument;
    const b = architectureDocumentSchema.parse(
      loadArch('adv06_order_b.json'),
    ) as ArchitectureDocument;
    const scenario = { type: 'load_multiplication' as const, multiplier: 2 };
    expect(simulate(a, scenario)).toEqual(simulate(b, scenario));
  });

  it('ADV-07 NO_IMPLIED_FALLBACK means no fallback inferred (not assumed absent)', () => {
    const architecture = loadArch('adv07_no_implied_fallback.json');
    const parsed = architectureDocumentSchema.parse(architecture);
    const result = simulate(parsed as ArchitectureDocument, {
      type: 'component_unavailable',
      componentId: 'db',
    });
    const assumption = result.assumptions.find(
      (a) => a.id === 'NO_IMPLIED_FALLBACK',
    );
    expect(assumption).toBeDefined();
    expect(assumption?.text.toLowerCase()).toContain('not treated as proof');
    const api = result.impacts.find((i) => i.componentId === 'api');
    expect(api?.impact).toBe('sync_failure_exposed');
    // Exposure ≠ outage claim; no fabricated "will fail" availability metric
    expect(
      result.metrics.some((m) => m.metricId === 'availability_percent'),
    ).toBe(false);
  });

  it('ADV-08 stored NL injection text must not affect deterministic simulate', () => {
    const nl = readFileSync(
      join(root, 'fixtures', 'adv08_injection_nl.md'),
      'utf8',
    );
    expect(nl).toContain('IGNORE PREVIOUS');
    expect(nl).toContain('utilization = 0');
    const architecture = loadArch('adv01_forced_numbers.json');
    const parsed = architectureDocumentSchema.parse(architecture);
    // Simulate only sees formal model — NL file is intentionally unused here.
    const result = simulate(parsed as ArchitectureDocument, {
      type: 'load_multiplication',
      multiplier: 1,
    });
    expect(
      result.metrics.find((m) => m.metricId === 'utilization:api')?.value,
    ).toBe(0.25);
  });
});
