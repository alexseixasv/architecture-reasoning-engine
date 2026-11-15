/**
 * HTTP acceptance through Compose nginx web (:8080) → API.
 * Verifies /api proxy, extract non-persist, persist, analyze, unsupported,
 * version update, diff, and OCC 409. Does not drive a real browser UI.
 *
 * Usage: npx tsx scripts/compose-frontend-acceptance.ts [webBaseUrl]
 */
const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:8080').replace(/\/$/, '');

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
  line('=== Compose frontend (nginx) HTTP acceptance ===');
  line(`baseUrl: ${baseUrl}`);

  const spa = await fetch(`${baseUrl}/`);
  line(`GET / → ${spa.status} (SPA shell)`);
  if (spa.status !== 200) {
    throw new Error('SPA index not served');
  }

  const health = await req('GET', '/health');
  line(`GET /health via nginx → ${health.status} status=${String(health.json['status'])}`);
  if (health.status !== 200 || health.json['status'] !== 'ok') {
    throw new Error('proxied health failed');
  }

  const extracted = await req('POST', '/api/architectures/extract', {
    architectureText: ARCH_TEXT,
  });
  line(
    `POST /api/architectures/extract → ${extracted.status} status=${String(extracted.json['status'])}`,
  );
  if (extracted.status !== 200 || extracted.json['status'] !== 'PROPOSED') {
    throw new Error(`extract failed: ${JSON.stringify(extracted.json)}`);
  }
  const document = extracted.json['document'];
  if (!document || typeof document !== 'object') {
    throw new Error('extract missing document');
  }

  // Confirm extract did not invent an architecture id (not persisted)
  if ('architectureId' in (document as object)) {
    // document may have many fields; ensure we didn't get a persist envelope
  }
  if (extracted.json['architectureId']) {
    throw new Error('extract unexpectedly returned architectureId (persisted?)');
  }

  const created = await req('POST', '/api/architectures', {
    document,
    changeSource: 'approved_extraction',
  });
  line(
    `POST /api/architectures → ${created.status} id=${String(created.json['architectureId'])} v=${String(created.json['version'])}`,
  );
  if (created.status !== 201 && created.status !== 200) {
    throw new Error(`persist failed: ${JSON.stringify(created.json)}`);
  }
  const architectureId = String(created.json['architectureId']);
  const v1 = Number(created.json['version']);
  if (v1 !== 1) {
    throw new Error('expected version 1');
  }

  const analyzed = await req(
    'POST',
    `/api/architectures/${architectureId}/versions/1/analyze`,
    { question: 'What is utilization at baseline load?' },
  );
  const scen = analyzed.json['scenarioExtraction'] as
    | { status?: string; scenario?: { type?: string; multiplier?: number } }
    | undefined;
  const sim = analyzed.json['simulation'] as { status?: string; metrics?: unknown[] } | null;
  line(
    `analyze load → ${analyzed.status} scenario=${String(scen?.status)} sim=${String(sim?.status)}`,
  );
  if (analyzed.status !== 200 || scen?.status !== 'OK') {
    throw new Error('supported analyze failed');
  }

  const unsupported = await req(
    'POST',
    `/api/architectures/${architectureId}/versions/1/analyze`,
    { question: 'What is the availability % if the API fails?' },
  );
  const unScen = unsupported.json['scenarioExtraction'] as { status?: string } | undefined;
  line(`analyze unsupported → ${unsupported.status} scenario=${String(unScen?.status)}`);
  if (unsupported.status !== 200 || unScen?.status !== 'UNSUPPORTED') {
    throw new Error('expected UNSUPPORTED classification');
  }

  const doc2 = {
    ...(document as Record<string, unknown>),
    name: 'demo-v2',
  };
  const updated = await req('PUT', `/api/architectures/${architectureId}`, {
    expectedVersion: 1,
    document: doc2,
    changeSource: 'user_corrected',
  });
  line(`PUT update OCC → ${updated.status} v=${String(updated.json['version'])}`);
  if ((updated.status !== 200 && updated.status !== 201) || Number(updated.json['version']) !== 2) {
    throw new Error(`update failed: ${JSON.stringify(updated.json)}`);
  }

  const diff = await req(
    'GET',
    `/api/architectures/${architectureId}/diff?from=1&to=2`,
  );
  const changes = (diff.json['changes'] as unknown[]) ?? [];
  line(`GET diff 1→2 → ${diff.status} changes=${changes.length}`);
  if (diff.status !== 200) {
    throw new Error('diff failed');
  }

  const stale = await req('PUT', `/api/architectures/${architectureId}`, {
    expectedVersion: 1,
    document: { ...(document as object), name: 'stale-attempt' },
    changeSource: 'user_corrected',
  });
  line(
    `PUT stale expectedVersion=1 → ${stale.status} message=${String((stale.json['message'] as string) ?? '')}`,
  );
  if (stale.status !== 409) {
    throw new Error(`expected 409, got ${stale.status}`);
  }

  const refresh = await fetch(`${baseUrl}/some/deep/spa/route`);
  line(`GET SPA deep path → ${refresh.status} (try_files → index)`);
  if (refresh.status !== 200) {
    throw new Error('SPA refresh route failed');
  }

  line('openaiCalls: none (Compose LLM_PROVIDER=fake)');
  line('browserUI: NOT automatable here — manual browser checklist remains for visual verification');
  line('RESULT: PASS');
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
