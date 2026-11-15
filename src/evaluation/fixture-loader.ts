import { readFileSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';

/** Reject oversized fixture files (defense in depth; fixtures are tiny). */
export const MAX_FIXTURE_BYTES = 256 * 1024;

const GOLDEN_DIRS: Readonly<Record<string, string>> = {
  G01: 'G01_capacity_sum_replicas',
  G02: 'G02_capacity_primary_only',
  G03: 'G03_load_normal',
  G04: 'G04_load_saturated',
  G05: 'G05_shared_downstream',
  G06: 'G06_failure_exposure',
  G07: 'G07_timeout_retry',
  G08: 'G08_missing_baseline',
  G09: 'G09_incomplete_inbound',
  G10: 'G10_timeout_equality',
  G11: 'G11_backoff_restrictions',
  G12: 'G12_conflicting_capacity',
};

const VALIDATION_DIRS: Readonly<Record<string, string>> = {
  V01: 'V01_capacity_sum',
  V02: 'V02_primary_only',
  V03: 'V03_load_normal',
  V04: 'V04_load_saturated',
  V05: 'V05_shared_downstream',
  V06: 'V06_failure_exposure',
  V07: 'V07_timeout_retry',
  V08: 'V08_missing_baseline',
  V09: 'V09_incomplete_inbound',
  V10: 'V10_unsupported_availability_pct',
  V11: 'V11_unsupported_e2e_latency',
  V12: 'V12_conflicting_capacity',
};

const ADVERSARIAL_FILES: Readonly<Record<string, string>> = {
  'adv01_forced_numbers.json': 'adv01_forced_numbers.json',
  'adv03_malformed_numbers.json': 'adv03_malformed_numbers.json',
  'adv04_contradictory.json': 'adv04_contradictory.json',
  'adv05_misleading_units.json': 'adv05_misleading_units.json',
  'adv06_order_a.json': 'adv06_order_a.json',
  'adv06_order_b.json': 'adv06_order_b.json',
  'adv07_no_implied_fallback.json': 'adv07_no_implied_fallback.json',
  'adv08_injection_nl.md': 'adv08_injection_nl.md',
};

export const GOLDEN_CASE_IDS = Object.keys(GOLDEN_DIRS);
export const VALIDATION_CASE_IDS = Object.keys(VALIDATION_DIRS);

function repoRoot(): string {
  return process.cwd();
}

function assertUnderRoot(root: string, resolved: string): void {
  const normalizedRoot = normalize(root + sep);
  const normalizedResolved = normalize(resolved);
  if (
    normalizedResolved !== normalize(root) &&
    !normalizedResolved.startsWith(normalizedRoot)
  ) {
    throw new Error('Fixture path escaped allowlisted root');
  }
}

function readAllowlistedFile(absolutePath: string): string {
  assertUnderRoot(repoRoot(), absolutePath);
  const size = statSync(absolutePath).size;
  if (size > MAX_FIXTURE_BYTES) {
    throw new Error(
      `Fixture exceeds MAX_FIXTURE_BYTES=${MAX_FIXTURE_BYTES}: ${absolutePath}`,
    );
  }
  return readFileSync(absolutePath, 'utf8');
}

export function loadGoldenCaseFiles(caseId: string): {
  architecture: unknown;
  scenario: unknown;
  expected: unknown;
  dirName: string;
} {
  const dirName = GOLDEN_DIRS[caseId];
  if (!dirName) {
    throw new Error(`Unknown golden caseId: ${caseId}`);
  }
  const dir = join(repoRoot(), 'tests', 'golden', dirName);
  return {
    dirName,
    architecture: JSON.parse(
      readAllowlistedFile(join(dir, 'architecture.json')),
    ) as unknown,
    scenario: JSON.parse(
      readAllowlistedFile(join(dir, 'scenario.json')),
    ) as unknown,
    expected: JSON.parse(
      readAllowlistedFile(join(dir, 'expected.json')),
    ) as unknown,
  };
}

export type ValidationMeta = {
  id: string;
  tags: string[];
  requirementIds: string[];
  execution: 'simulate' | 'schema_only';
  unsupportedNlOutcome?: string;
};

export function loadValidationCaseFiles(caseId: string): {
  meta: ValidationMeta;
  formalModel: unknown;
  expectedScenario: unknown | null;
  expectedSimulation: unknown | null;
  dirName: string;
} {
  const dirName = VALIDATION_DIRS[caseId];
  if (!dirName) {
    throw new Error(`Unknown validation caseId: ${caseId}`);
  }
  const dir = join(repoRoot(), 'tests', 'validation', dirName);
  const meta = JSON.parse(
    readAllowlistedFile(join(dir, 'meta.json')),
  ) as ValidationMeta;
  const expectedScenario = JSON.parse(
    readAllowlistedFile(join(dir, 'expected_scenario.json')),
  ) as unknown | null;
  const expectedSimulation = JSON.parse(
    readAllowlistedFile(join(dir, 'expected_simulation.json')),
  ) as unknown | null;
  return {
    dirName,
    meta,
    formalModel: JSON.parse(
      readAllowlistedFile(join(dir, 'formal_model.json')),
    ) as unknown,
    expectedScenario,
    expectedSimulation,
  };
}

export function loadAdversarialFixture(fileName: string): string {
  const allowed = ADVERSARIAL_FILES[fileName];
  if (!allowed) {
    throw new Error(`Unknown adversarial fixture: ${fileName}`);
  }
  const path = join(
    repoRoot(),
    'tests',
    'adversarial',
    'fixtures',
    allowed,
  );
  return readAllowlistedFile(path);
}

export function loadAdversarialJson(fileName: string): unknown {
  return JSON.parse(loadAdversarialFixture(fileName)) as unknown;
}
