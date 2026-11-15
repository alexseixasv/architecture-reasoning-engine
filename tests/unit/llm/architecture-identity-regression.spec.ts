import { describe, expect, it, beforeEach } from 'vitest';
import { ARCHITECTURE_EXTRACTION_SCHEMA_NAME } from '../../../src/llm/dto/architecture-extraction.dto';
import { extractArchitecture } from '../../../src/llm/extraction/extract-architecture';
import { FakeLlmProvider } from '../../../src/llm/provider/fake-llm-provider';
import { ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT } from '../../../src/llm/prompts/architecture';
import { clearUsageRecords } from '../../../src/llm/usage/usage-recorder';
import { declared, omitted } from './helpers';

/**
 * Offline identity regressions using architecture prose NOT present in V01–V12.
 * Asserts mapper+prompt contracts: consistent ids across nodes/deps/ingress;
 * no dataset-specific hardcoding.
 */
const NON_DATASET_ARCH = [
  'The Inventory Gateway service runs 3 replicas, each handling 50 requests per second.',
  'Capacity is the sum across replicas.',
  'Inventory Gateway calls Stock Ledger synchronously with a 200 ms timeout and fan-out of 2.',
  'Baseline ingress traffic is 40 rps into Inventory Gateway.',
].join(' ');

describe('architecture identity consistency (non-dataset)', () => {
  beforeEach(() => {
    clearUsageRecords();
  });

  it('prompt requires stable ids derived from described components (no V-dataset hardcoding)', () => {
    expect(ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /Derive each node id from the component/i,
    );
    expect(ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /Reuse the exact same id/i,
    );
    expect(ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT).not.toMatch(/V0[0-9]/);
    expect(ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT).not.toMatch(/checkout-pricing/i);
  });

  it('maps consistent node/dependency/ingress ids without inventing duplicates', async () => {
    const fake = new FakeLlmProvider();
    fake.setHandler(ARCHITECTURE_EXTRACTION_SCHEMA_NAME, async (req) => {
      expect(req.userContent).toContain('Inventory Gateway');
      expect(req.userContent).toContain('Stock Ledger');
      return {
        ok: true,
        data: {
          name: 'inventory',
          description: '',
          nodes: [
            {
              id: 'inventory_gateway',
              kind: 'service' as const,
              name: 'Inventory Gateway',
              replicas: declared(3, 'count', '3 replicas'),
              capacityPerReplica: declared(
                50,
                'rps',
                '50 requests per second',
              ),
              capacityAggregation: 'sum_replicas' as const,
              declaredLatency: omitted(),
              fieldConflicts: [],
            },
            {
              id: 'stock_ledger',
              kind: 'datastore' as const,
              name: 'Stock Ledger',
              replicas: omitted(),
              capacityPerReplica: omitted(),
              capacityAggregation: 'omitted' as const,
              declaredLatency: omitted(),
              fieldConflicts: [],
            },
          ],
          dependencies: [
            {
              id: 'inventory_gateway_to_stock_ledger',
              from: 'inventory_gateway',
              to: 'stock_ledger',
              communication: 'sync' as const,
              timeout: declared(200, 'ms', '200 ms timeout'),
              retry: { presence: 'omitted' as const },
              requestsPerParent: declared(2, 'ratio', 'fan-out of 2'),
            },
          ],
          incomingTraffic: declared(40, 'rps', '40 rps'),
          availabilityTarget: omitted(),
          ingressNodeIds: ['inventory_gateway'],
          ingressDeclared: true,
          documentConflicts: [],
          clarificationQuestions: [],
          notes: [],
        },
        model: 'fake',
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        durationMs: 1,
      };
    });

    const result = await extractArchitecture({
      architectureText: NON_DATASET_ARCH,
      provider: fake,
    });
    expect(result.status).toBe('PROPOSED');
    if (result.status !== 'PROPOSED') {
      return;
    }

    const nodeIds = result.document.nodes.map((n) => n.id).sort();
    expect(nodeIds).toEqual(['inventory_gateway', 'stock_ledger']);
    expect(result.document.dependencies).toHaveLength(1);
    const dep = result.document.dependencies[0]!;
    expect(dep.from).toBe('inventory_gateway');
    expect(dep.to).toBe('stock_ledger');
    expect(result.document.system?.ingressNodeIds).toEqual([
      'inventory_gateway',
    ]);
    expect(dep.timeout).toMatchObject({ state: 'known', value: 200, unit: 'ms' });
    expect(dep.requestsPerParent).toMatchObject({
      state: 'known',
      value: 2,
      unit: 'ratio',
    });
    // No duplicate representations of the same component
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
  });

  it('does not invent numerical quantities when DTO omits them', async () => {
    const text =
      'The Billing Orchestrator talks to Tax Engine. No replica or capacity numbers are given.';
    const fake = new FakeLlmProvider();
    fake.setHandler(ARCHITECTURE_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: {
        name: 'billing',
        description: '',
        nodes: [
          {
            id: 'billing_orchestrator',
            kind: 'service' as const,
            name: 'Billing Orchestrator',
            replicas: omitted(),
            capacityPerReplica: omitted(),
            capacityAggregation: 'omitted' as const,
            declaredLatency: omitted(),
            fieldConflicts: [],
          },
          {
            id: 'tax_engine',
            kind: 'service' as const,
            name: 'Tax Engine',
            replicas: omitted(),
            capacityPerReplica: omitted(),
            capacityAggregation: 'omitted' as const,
            declaredLatency: omitted(),
            fieldConflicts: [],
          },
        ],
        dependencies: [
          {
            id: 'billing_orchestrator_to_tax_engine',
            from: 'billing_orchestrator',
            to: 'tax_engine',
            communication: 'sync' as const,
            timeout: omitted(),
            retry: { presence: 'omitted' as const },
            requestsPerParent: omitted(),
          },
        ],
        incomingTraffic: omitted(),
        availabilityTarget: omitted(),
        ingressNodeIds: [],
        ingressDeclared: false,
        documentConflicts: [],
        clarificationQuestions: ['How many replicas does Billing Orchestrator run?'],
        notes: [],
      },
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const result = await extractArchitecture({
      architectureText: text,
      provider: fake,
    });
    expect(result.status).toBe('PROPOSED');
    if (result.status !== 'PROPOSED') {
      return;
    }
    for (const n of result.document.nodes) {
      expect(n.replicas).toBeUndefined();
      expect(n.capacityPerReplica).toBeUndefined();
    }
    expect(result.document.dependencies[0]?.timeout).toBeUndefined();
    expect(result.document.system?.incomingTraffic).toBeUndefined();
  });
});
