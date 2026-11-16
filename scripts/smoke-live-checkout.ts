/**
 * One-shot smoke for the live checkout-pricing Fake path via nginx :8080.
 */
const base = (process.argv[2] ?? 'http://127.0.0.1:8080/api').replace(/\/$/, '');

const arch = [
  'The checkout API calls the pricing service synchronously with a 2s timeout',
  'and 3 retries. Pricing reads from a single Postgres primary. Checkout also',
  'publishes an event to a queue consumed by the invoicing worker. Checkout',
  'runs 6 replicas, pricing 4, each handling 80 rps. Target is 99.9% availability.',
  'MY actual availability is 95%.',
  '',
  'My actual RPS is 80%',
].join('\n');

const question =
  "Let's suppose my PostgreSQL starts growing up the latency for 2s, what could happen to my architecture?";

async function main(): Promise<void> {
  const extract = (await (
    await fetch(`${base}/architectures/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ architectureText: arch }),
    })
  ).json()) as {
    status: string;
    document: { nodes: Array<{ id: string }> };
    findings: Array<{ code: string }>;
  };

  console.log(
    'extract',
    extract.status,
    extract.document.nodes.map((n) => n.id).join(','),
  );
  console.log('findings', extract.findings.map((f) => f.code).join(','));

  const created = (await (
    await fetch(`${base}/architectures`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        document: extract.document,
        changeSource: 'approved_extraction',
      }),
    })
  ).json()) as { architectureId: string; version: number };

  console.log('persist', created.architectureId, `v${created.version}`);

  const analyze = (await (
    await fetch(
      `${base}/architectures/${created.architectureId}/versions/${created.version}/analyze`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      },
    )
  ).json()) as {
    scenarioExtraction: { status: string; scenario: unknown };
    simulation?: { status?: string; refused?: Array<{ reasonCode: string }> };
  };

  console.log(
    'scenario',
    analyze.scenarioExtraction.status,
    JSON.stringify(analyze.scenarioExtraction.scenario),
  );
  console.log('sim', analyze.simulation?.status);
  console.log(
    'refused',
    (analyze.simulation?.refused ?? [])
      .map((r) => r.reasonCode)
      .slice(0, 6)
      .join(','),
  );

  const scenario = analyze.scenarioExtraction.scenario as {
    type?: string;
    componentId?: string;
    latencyMs?: number;
  } | null;
  if (
    analyze.scenarioExtraction.status !== 'OK' ||
    scenario?.type !== 'latency_degradation' ||
    scenario.componentId !== 'postgres' ||
    scenario.latencyMs !== 2000
  ) {
    throw new Error('live checkout latency scenario failed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
