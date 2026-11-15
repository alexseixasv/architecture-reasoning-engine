import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import {
  type GoldenExpected,
  runGoldenCase,
} from './assertGolden';

const root = join(process.cwd(), 'tests', 'golden');

const cases = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^G\d{2}_/.test(d.name))
  .map((d) => d.name)
  .sort();

describe('golden suite G01–G12', () => {
  it('discovers all 12 planned cases', () => {
    if (cases.length !== 12) {
      throw new Error(`expected 12 golden dirs, found ${cases.length}: ${cases.join(', ')}`);
    }
  });

  for (const name of cases) {
    it(name, () => {
      const dir = join(root, name);
      const architecture = JSON.parse(
        readFileSync(join(dir, 'architecture.json'), 'utf8'),
      ) as unknown;
      const scenario = JSON.parse(
        readFileSync(join(dir, 'scenario.json'), 'utf8'),
      ) as unknown;
      const expected = JSON.parse(
        readFileSync(join(dir, 'expected.json'), 'utf8'),
      ) as GoldenExpected;
      runGoldenCase({ architecture, scenario, expected });
    });
  }
});
