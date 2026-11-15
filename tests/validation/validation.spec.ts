import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GoldenExpected } from '../golden/assertGolden';
import {
  assertValidationPair,
  type ValidationMeta,
} from './assertValidationPair';

const root = join(process.cwd(), 'tests', 'validation');

const cases = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^V\d{2}_/.test(d.name))
  .map((d) => d.name)
  .sort();

function readJson(path: string): unknown {
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw) as unknown;
}

describe('validation dataset V01–V12', () => {
  it('discovers all 12 pairs', () => {
    expect(cases).toHaveLength(12);
  });

  for (const name of cases) {
    it(name, () => {
      const dir = join(root, name);
      const meta = readJson(join(dir, 'meta.json')) as ValidationMeta;
      const formalModel = readJson(join(dir, 'formal_model.json'));
      const expectedScenario = readJson(join(dir, 'expected_scenario.json'));
      const expectedSimulation = readJson(
        join(dir, 'expected_simulation.json'),
      ) as GoldenExpected | null;

      expect(readFileSync(join(dir, 'architecture_nl.md'), 'utf8').trim().length).toBeGreaterThan(0);
      expect(readFileSync(join(dir, 'scenario_nl.md'), 'utf8').trim().length).toBeGreaterThan(0);
      expect(meta.tags.length).toBeGreaterThan(0);
      expect(meta.requirementIds.length).toBeGreaterThan(0);

      assertValidationPair({
        formalModel,
        expectedScenario,
        expectedSimulation,
        meta,
      });
    });
  }
});
