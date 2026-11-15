/**
 * Evaluation Lab acceptance against running Compose (Fake LLM + demo override).
 *
 * Requires EVAL_LAB_ENABLED=1 on the API, e.g.:
 *   docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
 *
 * Usage:
 *   npx tsx scripts/compose-evaluation-acceptance.ts [webBaseUrl] [apiBaseUrl]
 *
 * Defaults: web http://127.0.0.1:8080 , api http://127.0.0.1:3000
 * Prefer verifying evaluation through nginx /api (same-origin path) when webBaseUrl is used.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const webBase = (process.argv[2] ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const apiBase = (process.argv[3] ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

type Json = Record<string, unknown>;

async function req(
  base: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Json; text: string }> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  let json: Json = {};
  try {
    json = text ? (JSON.parse(text) as Json) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, text };
}

function line(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function findCase(
  suites: unknown[],
  caseId: string,
): Json | undefined {
  for (const suite of suites) {
    if (suite === null || typeof suite !== 'object') continue;
    const cases = asArray((suite as Json)['cases']);
    for (const c of cases) {
      if (
        c !== null &&
        typeof c === 'object' &&
        (c as Json)['caseId'] === caseId
      ) {
        return c as Json;
      }
    }
  }
  return undefined;
}

function assertComposeGateDefaultOff(): void {
  const composePath = join(process.cwd(), 'docker-compose.yml');
  const demoPath = join(process.cwd(), 'docker-compose.demo.yml');
  const base = readFileSync(composePath, 'utf8');
  const demo = readFileSync(demoPath, 'utf8');
  assert(
    !/EVAL_LAB_ENABLED\s*:\s*['"]?1['"]?/.test(base),
    'docker-compose.yml must not enable EVAL_LAB_ENABLED by default',
  );
  assert(
    /EVAL_LAB_ENABLED:\s*['"]1['"]/.test(demo),
    'docker-compose.demo.yml must set EVAL_LAB_ENABLED=1',
  );
  line('OK compose gate: base default-off; demo override enables Lab');
}

async function main(): Promise<void> {
  line('=== Compose Evaluation Lab acceptance ===');
  line(`webBase: ${webBase}`);
  line(`apiBase: ${apiBase}`);

  assertComposeGateDefaultOff();

  // 1. API health (direct)
  const health = await req(apiBase, 'GET', '/health');
  line(`1 GET ${apiBase}/health → ${health.status}`);
  assert(health.status === 200 && health.json['status'] === 'ok', 'API health failed');

  // 2–3. Workspace SPA + Evaluation Lab deep link
  const spa = await fetch(`${webBase}/`);
  line(`2 GET ${webBase}/ → ${spa.status}`);
  assert(spa.status === 200, 'Workspace SPA not served');
  const spaHtml = await spa.text();
  assert(spaHtml.includes('<div id="app">'), 'SPA shell missing #app');

  const lab = await fetch(`${webBase}/evaluation`);
  line(`3 GET ${webBase}/evaluation → ${lab.status}`);
  assert(lab.status === 200, 'Evaluation Lab deep link failed');
  const labHtml = await lab.text();
  assert(labHtml.includes('<div id="app">'), 'Lab SPA shell missing #app');

  // Prefer nginx /api path for evaluation (same-origin as browser)
  const evalBase = webBase;
  const evalPrefix = '/api';

  // 4. GET suites
  const suitesRes = await req(evalBase, 'GET', `${evalPrefix}/evaluation/suites`);
  line(`4 GET /api/evaluation/suites → ${suitesRes.status}`);
  if (suitesRes.status === 403) {
    throw new Error(
      'Evaluation Lab disabled (403). Start with docker-compose.demo.yml (EVAL_LAB_ENABLED=1).',
    );
  }
  assert(suitesRes.status === 200, `suites failed: ${suitesRes.text}`);
  const suites = asArray(suitesRes.json['suites']);
  assert(suites.length >= 4, 'expected ≥4 suite descriptors');
  const full = suites.find(
    (s) =>
      s !== null &&
      typeof s === 'object' &&
      (s as Json)['id'] === 'deterministic_full',
  ) as Json | undefined;
  assert(full, 'missing deterministic_full suite');
  assert(full['caseCount'] === 32, `deterministic_full caseCount=${String(full['caseCount'])}`);
  assert(full['requiresOpenAi'] === false, 'suite must not require OpenAI');

  // 5–8. POST deterministic_full
  const runRes = await req(evalBase, 'POST', `${evalPrefix}/evaluation/runs`, {
    suiteId: 'deterministic_full',
  });
  line(`5 POST /api/evaluation/runs → ${runRes.status}`);
  assert(runRes.status === 200, `run failed: ${runRes.text}`);
  const summary = runRes.json['summary'] as Json;
  assert(summary, 'missing summary');
  assert(summary['total'] === 32, `expected total 32, got ${String(summary['total'])}`);
  assert(summary['failed'] === 0, `expected failed 0, got ${String(summary['failed'])}`);
  assert(summary['passed'] === 32, `expected passed 32, got ${String(summary['passed'])}`);
  assert(runRes.json['overallStatus'] === 'passed', 'overallStatus not passed');
  line(
    `6 summary total=${String(summary['total'])} passed=${String(summary['passed'])} failed=${String(summary['failed'])} durationMs=${String(summary['durationMs'])}`,
  );

  const runSuites = asArray(runRes.json['suites']);
  assert(runSuites.length === 3, `expected 3 suite blocks, got ${runSuites.length}`);
  const byId = Object.fromEntries(
    runSuites.map((s) => {
      const sj = s as Json;
      return [String(sj['suiteId']), sj];
    }),
  );
  assert(asArray(byId['golden']?.['cases']).length === 12, 'golden cases ≠ 12');
  assert(
    asArray(byId['validation_formal']?.['cases']).length === 12,
    'validation_formal cases ≠ 12',
  );
  assert(asArray(byId['adversarial']?.['cases']).length === 8, 'adversarial cases ≠ 8');
  line('7 suite totals: golden=12 validation_formal=12 adversarial=8');

  // 8–11. Per-case evidence
  const g01 = findCase(runSuites, 'G01');
  assert(g01, 'G01 missing');
  assert(g01['status'] === 'passed', 'G01 not passed');
  assert(g01['checkKind'] === 'simulation_correctness', 'G01 checkKind');
  const g01Evidence = g01['evidence'] as Json;
  const metricEvidence = asArray(g01Evidence?.['metricEvidence']);
  const util = metricEvidence.find(
    (m) =>
      m !== null &&
      typeof m === 'object' &&
      (m as Json)['metricId'] === 'utilization:api',
  ) as Json | undefined;
  assert(util, 'G01 missing utilization:api evidence');
  assert(util['formulaId'] === 'F-UTIL-001', `G01 formulaId=${String(util['formulaId'])}`);
  assert(
    Array.isArray(util['substitutions']) &&
      (util['substitutions'] as unknown[]).length > 0,
    'G01 substitutions missing',
  );
  line(
    `9 G01 formulaId=${String(util['formulaId'])} substitutions=${(util['substitutions'] as unknown[]).length}`,
  );

  const v10 = findCase(runSuites, 'V10');
  assert(v10, 'V10 missing');
  assert(v10['checkKind'] === 'schema_validation', 'V10 must be schema_validation');
  assert(v10['status'] === 'passed', 'V10 not passed');
  line(`10 V10 checkKind=${String(v10['checkKind'])}`);

  const adv08 = findCase(runSuites, 'ADV-08');
  assert(adv08, 'ADV-08 missing');
  assert(adv08['checkKind'] === 'nl_isolation_check', 'ADV-08 must be nl_isolation_check');
  assert(adv08['status'] === 'passed', 'ADV-08 not passed');
  const verifies = String(adv08['verifies'] ?? '');
  assert(
    /does NOT prove LLM prompt-injection/i.test(verifies),
    'ADV-08 verifies text missing injection disclaimer',
  );
  line(`11 ADV-08 checkKind=${String(adv08['checkKind'])}`);

  // 12–15. Historical
  const histRes = await req(
    evalBase,
    'GET',
    `${evalPrefix}/evaluation/historical`,
  );
  line(`12 GET /api/evaluation/historical → ${histRes.status}`);
  assert(histRes.status === 200, `historical failed: ${histRes.text}`);
  const disclaimer = String(histRes.json['disclaimer'] ?? '');
  assert(
    disclaimer === 'Historical OpenAI evaluation — not executed in this run',
    `unexpected disclaimer: ${disclaimer}`,
  );
  line(`14 disclaimer OK`);

  const artifacts = asArray(histRes.json['artifacts']);
  assert(artifacts.length >= 2, 'expected ≥2 historical artifacts');
  const baseline = artifacts.find(
    (a) =>
      a !== null &&
      typeof a === 'object' &&
      (a as Json)['passLabel'] === 'baseline',
  ) as Json | undefined;
  const remediation = artifacts.find(
    (a) =>
      a !== null &&
      typeof a === 'object' &&
      (a as Json)['passLabel'] === 'remediation',
  ) as Json | undefined;
  assert(baseline, 'baseline artifact missing');
  assert(remediation, 'remediation artifact missing');

  const bMetrics = baseline['metrics'] as Json;
  const rMetrics = remediation['metrics'] as Json;
  const bField = bMetrics['fieldAccuracy'] as Json;
  const rField = rMetrics['fieldAccuracy'] as Json;
  assert(bField['matches'] === 120 && bField['total'] === 235, 'baseline field accuracy');
  assert(rField['matches'] === 141 && rField['total'] === 244, 'remediation field accuracy');
  assert(
    typeof baseline['sourceArtifactSha256'] === 'string' &&
      (baseline['sourceArtifactSha256'] as string).length === 64,
    'baseline SHA-256 missing',
  );
  assert(
    typeof remediation['sourceArtifactSha256'] === 'string' &&
      (remediation['sourceArtifactSha256'] as string).length === 64,
    'remediation SHA-256 missing',
  );
  assert(asArray(baseline['cases']).length === 12, 'baseline cases ≠ 12');
  assert(asArray(remediation['cases']).length === 12, 'remediation cases ≠ 12');
  line(
    `13 historical baseline ${String(bField['matches'])}/${String(bField['total'])} remediation ${String(rField['matches'])}/${String(rField['total'])}`,
  );

  // 15. Historical metrics not mixed into run totals
  assert(summary['total'] === 32, 'run total must remain 32 (not historical denominators)');
  assert(summary['total'] !== bField['total'], 'run total must not equal historical field total');
  line('15 run totals isolated from historical field denominators');

  // 16. Invalid suite
  const bad = await req(evalBase, 'POST', `${evalPrefix}/evaluation/runs`, {
    suiteId: 'not-a-real-suite',
  });
  line(`16 invalid suite → ${bad.status}`);
  assert(bad.status === 400, `expected 400 for invalid suite, got ${bad.status}`);

  // 17. Direct API also serves evaluation (and still gated when disabled — file check above)
  const directSuites = await req(apiBase, 'GET', '/evaluation/suites');
  assert(directSuites.status === 200, 'direct API suites failed');
  line('17 direct API /evaluation/suites OK (gate enforced by EVAL_LAB_ENABLED)');

  // Sanity: nginx still proxies architecture health path used by workspace
  const proxiedHealth = await req(webBase, 'GET', '/health');
  assert(proxiedHealth.status === 200, 'nginx /health proxy broken');

  line('=== Evaluation Lab acceptance PASSED ===');
}

main().catch((err) => {
  process.stderr.write(
    `Evaluation acceptance FAILED: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
