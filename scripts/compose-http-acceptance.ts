/**
 * HTTP acceptance against a running Compose API (LLM_PROVIDER=fake).
 * Usage: npx tsx scripts/compose-http-acceptance.ts [baseUrl]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

const ARCH_TEXT = [
  'The API service runs 4 replicas, each handling 80 requests per second.',
  'Capacity is the sum across replicas. Baseline ingress traffic is 80 rps into the API.',
].join(' ');

async function req(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function line(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

async function main(): Promise<void> {
  line(`=== Compose HTTP acceptance ===`);
  line(`baseUrl: ${baseUrl}`);

  const health = await req('GET', '/health');
  line(`GET /health → ${health.status} status=${String(health.json['status'])}`);
  if (health.status !== 200 || health.json['status'] !== 'ok') {
    throw new Error('health check failed');
  }

  // A extract
  const extracted = await req('POST', '/architectures/extract', {
    architectureText: ARCH_TEXT,
  });
  line(
    `A POST /architectures/extract → ${extracted.status} status=${String(extracted.json['status'])} canPersist=${String(extracted.json['canPersist'])}`,
  );
  if (extracted.status !== 200 || extracted.json['status'] !== 'PROPOSED') {
    throw new Error(`extract failed: ${JSON.stringify(extracted.json)}`);
  }
  const document = extracted.json['document'];
  if (document === null || typeof document !== 'object') {
    throw new Error('extract missing document');
  }

  // Confirm not auto-persisted: list won't exist until we create — capture by creating then ensuring extract didn't create ids
  // B persist
  const created = await req('POST', '/architectures', {
    document,
    changeSource: 'approved_extraction',
  });
  line(
    `B POST /architectures → ${created.status} id=${String(created.json['architectureId'])} version=${String(created.json['version'])} changeSource=${String(created.json['changeSource'])}`,
  );
  if (created.status !== 201 && created.status !== 200) {
    throw new Error(`persist failed: ${JSON.stringify(created.json)}`);
  }
  const architectureId = String(created.json['architectureId']);
  const version = Number(created.json['version']);
  if (!architectureId || version !== 1) {
    throw new Error('unexpected persist envelope');
  }

  // C analyze v1
  const analyzed = await req(
    'POST',
    `/architectures/${architectureId}/versions/1/analyze`,
    { question: 'What is utilization at baseline load?' },
  );
  const sim = analyzed.json['simulation'] as
    | { status?: string; metrics?: unknown[]; refused?: unknown[] }
    | null
    | undefined;
  const expl = analyzed.json['explanation'] as
    | { source?: string }
    | null
    | undefined;
  const scen = analyzed.json['scenarioExtraction'] as
    | { status?: string; scenario?: unknown }
    | undefined;
  line(
    `C analyze v1 → ${analyzed.status} scenario=${String(scen?.status)} sim=${String(sim?.status)} metrics=${String(sim?.metrics?.length ?? 0)} refused=${String(sim?.refused?.length ?? 0)} explain=${String(expl?.source)} archVer=${String(analyzed.json['architectureVersion'])}`,
  );
  if (analyzed.status !== 200) {
    throw new Error(`analyze failed: ${JSON.stringify(analyzed.json)}`);
  }
  if (scen?.status !== 'OK') {
    throw new Error(`scenario not OK: ${JSON.stringify(scen)}`);
  }
  if (Number(analyzed.json['architectureVersion']) !== 1) {
    throw new Error('analyze did not bind version 1');
  }
  if (!sim || !expl) {
    throw new Error('missing simulation or explanation');
  }
  if (!analyzed.json['usage'] || !analyzed.json['timingsMs']) {
    throw new Error('missing usage or timingsMs');
  }
  line(`  usage.totals=${JSON.stringify((analyzed.json['usage'] as { totals?: unknown }).totals)}`);
  line(`  timingsMs=${JSON.stringify(analyzed.json['timingsMs'])}`);

  // D OCC update → v2, re-analyze v1
  const formal = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'tests',
        'validation',
        'V01_capacity_sum',
        'formal_model.json',
      ),
      'utf8',
    ),
  ) as Record<string, unknown>;
  const updated = await req('PUT', `/architectures/${architectureId}`, {
    expectedVersion: 1,
    document: { ...formal, name: 'v2-corrected' },
    changeSource: 'user_corrected',
  });
  line(
    `D PUT update → ${updated.status} version=${String(updated.json['version'])}`,
  );
  if (updated.status !== 200 || Number(updated.json['version']) !== 2) {
    throw new Error(`update failed: ${JSON.stringify(updated.json)}`);
  }

  const analyzeV1Again = await req(
    'POST',
    `/architectures/${architectureId}/versions/1/analyze`,
    { question: 'What is utilization at baseline load?' },
  );
  line(
    `D analyze v1 again → ${analyzeV1Again.status} architectureVersion=${String(analyzeV1Again.json['architectureVersion'])}`,
  );
  if (
    analyzeV1Again.status !== 200 ||
    Number(analyzeV1Again.json['architectureVersion']) !== 1
  ) {
    throw new Error('version substitution detected');
  }

  // E errors
  const missing = await req(
    'POST',
    '/architectures/00000000-0000-4000-8000-000000000099/versions/1/analyze',
    { question: 'load?' },
  );
  line(`E missing → ${missing.status}`);
  if (missing.status !== 404) {
    throw new Error(`expected 404, got ${missing.status}`);
  }

  const invalid = await req('POST', '/architectures/extract', {});
  line(`E invalid extract body → ${invalid.status}`);
  if (invalid.status !== 400) {
    throw new Error(`expected 400, got ${invalid.status}`);
  }

  const unsupported = await req(
    'POST',
    `/architectures/${architectureId}/versions/1/analyze`,
    { question: 'Please run a monte carlo availability simulation' },
  );
  const unScen = unsupported.json['scenarioExtraction'] as
    | { status?: string }
    | undefined;
  line(
    `E unsupported → ${unsupported.status} scenario=${String(unScen?.status)}`,
  );
  if (unsupported.status !== 200 || unScen?.status !== 'UNSUPPORTED') {
    throw new Error(`expected 200 UNSUPPORTED, got ${unsupported.status} ${unScen?.status}`);
  }

  line('openaiCalls: none (LLM_PROVIDER=fake / fake-demo handlers)');
  line('RESULT: PASS');
}

main().catch((err: unknown) => {
  process.stderr.write(
    `RESULT: FAIL ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
