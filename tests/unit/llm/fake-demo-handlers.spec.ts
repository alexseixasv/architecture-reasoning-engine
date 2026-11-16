import { describe, expect, it } from 'vitest';
import { extractArchitecture } from '../../../src/llm/extraction/extract-architecture';
import { extractScenario } from '../../../src/llm/extraction/extract-scenario';
import { FakeLlmProvider } from '../../../src/llm/provider/fake-llm-provider';
import { installFakeDemoHandlers } from '../../../src/llm/provider/fake-demo-handlers';
import { simulate } from '../../../src/simulation/simulate';

const CHECKOUT_PRICING_TEXT = [
  'The checkout API calls the pricing service synchronously with a 2s timeout',
  'and 3 retries. Pricing reads from a single Postgres primary. Checkout also',
  'publishes an event to a queue consumed by the invoicing worker. Checkout',
  'runs 6 replicas, pricing 4, each handling 80 rps. Target is 99.9% availability.',
  'MY actual availability is 95%.',
  '',
  'My actual RPS is 80%',
].join('\n');

const POSTGRES_LATENCY_QUESTION =
  "Let's suppose my PostgreSQL starts growing up the latency for 2s, what could happen to my architecture?";

function demoProvider(): FakeLlmProvider {
  const fake = new FakeLlmProvider();
  installFakeDemoHandlers(fake);
  return fake;
}

describe('fake demo handlers — checkout-pricing live case', () => {
  it('extracts checkout/pricing/postgres graph with persistable semantic warnings', async () => {
    const result = await extractArchitecture({
      architectureText: CHECKOUT_PRICING_TEXT,
      provider: demoProvider(),
    });

    expect(result.status).toBe('PROPOSED');
    if (result.status !== 'PROPOSED') {
      return;
    }

    const ids = result.document.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(
      ['checkout', 'invoice-queue', 'invoicing', 'postgres', 'pricing'].sort(),
    );

    const checkout = result.document.nodes.find((n) => n.id === 'checkout');
    expect(checkout?.replicas).toMatchObject({ state: 'known', value: 6 });
    const pricing = result.document.nodes.find((n) => n.id === 'pricing');
    expect(pricing?.replicas).toMatchObject({ state: 'known', value: 4 });
    expect(result.document.system?.availabilityTarget).toMatchObject({
      state: 'known',
      value: 99.9,
    });

    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('SPOF');
    expect(codes).toContain('RETRY_WITHOUT_BACKOFF');
    expect(codes).toContain('SYNC_MISSING_TIMEOUT');
    expect(codes).not.toContain('PROVENANCE_UNVERIFIED');
    expect(result.canPersist).toBe(true);
  });

  it('classifies postgres +2s as latency_degradation and does not invent availability %', async () => {
    const extracted = await extractArchitecture({
      architectureText: CHECKOUT_PRICING_TEXT,
      provider: demoProvider(),
    });
    expect(extracted.status).toBe('PROPOSED');
    if (extracted.status !== 'PROPOSED') {
      return;
    }

    const scenario = await extractScenario({
      question: POSTGRES_LATENCY_QUESTION,
      architecture: extracted.document,
      provider: demoProvider(),
    });
    expect(scenario.status).toBe('OK');
    if (scenario.status !== 'OK') {
      return;
    }
    expect(scenario.scenario).toMatchObject({
      type: 'latency_degradation',
      componentId: 'postgres',
      latencyMs: 2000,
    });

    const sim = simulate(extracted.document, scenario.scenario);
    expect(
      sim.refused.some((r) => r.reasonCode === 'NO_AVAILABILITY_MODEL'),
    ).toBe(true);
    expect(
      sim.refused.some(
        (r) =>
          r.metricId.startsWith('timeout_violated:') &&
          r.reasonCode === 'MISSING_TIMEOUT',
      ),
    ).toBe(true);
  });

  it('keeps the simple API demo path unchanged', async () => {
    const text =
      'The API service runs 4 replicas, each handling 80 requests per second. Capacity is the sum across replicas. Baseline ingress traffic is 80 rps into the API.';
    const result = await extractArchitecture({
      architectureText: text,
      provider: demoProvider(),
    });
    expect(result.status).toBe('PROPOSED');
    if (result.status !== 'PROPOSED') {
      return;
    }
    expect(result.document.nodes).toHaveLength(1);
    expect(result.document.nodes[0]?.id).toBe('api');
    expect(result.document.nodes[0]?.replicas).toMatchObject({
      state: 'known',
      value: 4,
    });
  });
});
