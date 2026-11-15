import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { ApiClientError } from '@/api/client';
import AppShell from '@/components/AppShell.vue';
import EvaluationLabView from '@/pages/EvaluationLabView.vue';
import WorkspaceView from '@/pages/WorkspaceView.vue';
import {
  createMockApi,
  sampleEvaluationRun,
  sampleHistoricalEvaluation,
} from './helpers/mockApi';

async function mountLab(client = createMockApi()) {
  const wrapper = mount(EvaluationLabView, {
    props: { client },
  });
  await flushPromises();
  return wrapper;
}

describe('EvaluationLabView', () => {
  it('loads suites and historical on mount, then runs evaluation', async () => {
    const mock = createMockApi();
    const wrapper = await mountLab(mock);

    expect(mock.calls).toContain('listEvaluationSuites');
    expect(mock.calls).toContain('getHistoricalEvaluation');
    expect(wrapper.text()).toContain(
      'Historical OpenAI evaluation — not executed in this run',
    );
    expect(wrapper.text()).toContain('120/235');

    const runBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Run evaluation suite'));
    expect(runBtn).toBeTruthy();
    await runBtn!.trigger('click');
    await flushPromises();

    expect(mock.calls.some((c) => c.startsWith('runEvaluation:'))).toBe(true);
    expect(wrapper.text()).toContain('Executive summary');
    expect(wrapper.text()).toContain('evr_test_001');
    // Summary values from mock backend — not hardcoded 32
    expect(wrapper.text()).toMatch(/Total[\s\S]*4/);
    expect(wrapper.text()).toContain('4');
    expect(wrapper.text()).toContain('Passed');
  });

  it('disables run button while running and blocks duplicate submits', async () => {
    let resolveRun: ((v: ReturnType<typeof sampleEvaluationRun>) => void) | null =
      null;
    const mock = createMockApi({
      async runEvaluation(suiteId) {
        mock.calls.push(`runEvaluation:${suiteId}`);
        return new Promise((resolve) => {
          resolveRun = resolve;
        });
      },
    });

    const wrapper = await mountLab(mock);
    const runBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Run evaluation suite'))!;

    await runBtn.trigger('click');
    await nextTick();
    expect(runBtn.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Running evaluation');

    await runBtn.trigger('click');
    await nextTick();
    expect(mock.calls.filter((c) => c.startsWith('runEvaluation:'))).toHaveLength(
      1,
    );

    resolveRun?.(sampleEvaluationRun());
    await flushPromises();
    expect(wrapper.text()).toContain('Evaluation completed');
  });

  it('shows actionable message on EVAL_LAB_DISABLED 403', async () => {
    const mock = createMockApi({
      async listEvaluationSuites() {
        mock.calls.push('listEvaluationSuites');
        throw new ApiClientError({
          message:
            'Evaluation Lab is disabled. Set EVAL_LAB_ENABLED=1 in an approved development/demo environment.',
          status: 403,
          errorClass: 'EVAL_LAB_DISABLED',
          body: {
            message:
              'Evaluation Lab is disabled. Set EVAL_LAB_ENABLED=1 in an approved development/demo environment.',
            code: 'EVAL_LAB_DISABLED',
          },
        });
      },
      async getHistoricalEvaluation() {
        mock.calls.push('getHistoricalEvaluation');
        throw new ApiClientError({
          message: 'Evaluation Lab is disabled.',
          status: 403,
          errorClass: 'EVAL_LAB_DISABLED',
        });
      },
    });

    const wrapper = await mountLab(mock);
    expect(wrapper.text()).toContain('Evaluation Lab disabled');
    expect(wrapper.text()).toContain('EVAL_LAB_ENABLED=1');
  });

  it('shows network error and preserves prior successful report', async () => {
    const mock = createMockApi();
    const wrapper = await mountLab(mock);

    const runBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Run evaluation suite'))!;
    await runBtn.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('evr_test_001');

    mock.runEvaluation = async () => {
      mock.calls.push('runEvaluation:fail');
      throw new ApiClientError({
        message: 'Network error contacting the API',
        status: 0,
        errorClass: 'NETWORK_ERROR',
      });
    };

    await runBtn.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Backend unavailable');
    expect(wrapper.text()).toContain('evr_test_001');
  });

  it('renders failed-case status and inspects evidence', async () => {
    const mock = createMockApi({
      async runEvaluation(suiteId) {
        mock.calls.push(`runEvaluation:${suiteId}`);
        return sampleEvaluationRun(suiteId, { failG03: true });
      },
    });
    const wrapper = await mountLab(mock);
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Run evaluation suite'))!
      .trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('failed');
    expect(wrapper.text()).toContain('G03');

    const statusSelect = wrapper
      .findAll('select')
      .find((s) => s.html().includes('value="failed"'));
    await statusSelect!.setValue('failed');
    await nextTick();
    const table = wrapper.find('table');
    expect(table.text()).toContain('G03');
    expect(table.text()).not.toContain('G01');

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Inspect')!
      .trigger('click');
    await nextTick();
    expect(wrapper.text()).toContain('Case detail');
    expect(wrapper.text()).toContain('status mismatch');
  });

  it('filters by suite and check kind', async () => {
    const mock = createMockApi();
    const wrapper = await mountLab(mock);
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Run evaluation suite'))!
      .trigger('click');
    await flushPromises();

    const selects = wrapper.findAll('select');
    // suite filter is second filter select after suite picker in controls
    const suiteFilter = selects.find((s) =>
      s.html().includes('validation_formal'),
    );
    expect(suiteFilter).toBeTruthy();
    await suiteFilter!.setValue('adversarial');
    await nextTick();
    expect(wrapper.text()).toContain('ADV-08');
    expect(wrapper.text()).not.toContain('capacity sum_replicas');
  });

  it('shows ADV-08 isolation disclaimer in case detail', async () => {
    const mock = createMockApi();
    const wrapper = await mountLab(mock);
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Run evaluation suite'))!
      .trigger('click');
    await flushPromises();

    await wrapper.find('input[type="search"]').setValue('ADV-08');
    await nextTick();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Inspect')!
      .trigger('click');
    await nextTick();
    expect(wrapper.text()).toContain('does not prove LLM');
    expect(wrapper.text()).toContain('NL isolation');
  });

  it('keeps historical metrics out of run totals', async () => {
    const mock = createMockApi();
    const wrapper = await mountLab(mock);
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Run evaluation suite'))!
      .trigger('click');
    await flushPromises();

    // Run summary total is 4 from mock — historical field totals 235/244 must not overwrite
    expect(wrapper.text()).toMatch(/Total\s*4/);
    expect(wrapper.text()).toMatch(/Passed\s*4/);
    expect(wrapper.text()).toContain('not included in the current');
    expect(wrapper.text()).toContain(
      'Historical OpenAI evaluation — not executed in this run',
    );
    // Historical numbers still visible in historical panel
    expect(wrapper.text()).toContain('120/235');
    expect(wrapper.text()).not.toMatch(/Total\s*235/);
  });

  it('exports JSON equal to the backend run object', async () => {
    const mock = createMockApi();
    const wrapper = await mountLab(mock);
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Run evaluation suite'))!
      .trigger('click');
    await flushPromises();

    let exported: string | null = null;
    const OriginalBlob = globalThis.Blob;
    vi.stubGlobal(
      'Blob',
      class MockBlob {
        private readonly parts: BlobPart[];
        constructor(parts: BlobPart[] = []) {
          this.parts = parts;
        }
        async text(): Promise<string> {
          return this.parts.map(String).join('');
        }
      },
    );
    const createObjectURL = vi.fn((blob: { text?: () => Promise<string> }) => {
      void blob.text?.().then((t) => {
        exported = t;
      });
      return 'blob:test';
    });
    const revoke = vi.fn();
    const click = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: revoke,
    });
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: click });
      }
      return el;
    });

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Export JSON'))!
      .trigger('click');
    await flushPromises();

    expect(createObjectURL).toHaveBeenCalled();
    expect(exported).toBeTruthy();
    const parsed = JSON.parse(exported!) as ReturnType<typeof sampleEvaluationRun>;
    expect(parsed.runId).toBe('evr_test_001');
    expect(parsed.summary).toEqual(sampleEvaluationRun().summary);
    expect(parsed.summary.total).toBe(4);

    vi.stubGlobal('Blob', OriginalBlob);
    vi.restoreAllMocks();
  });

  it('renders historical sample when API returns empty artifacts', async () => {
    const mock = createMockApi({
      async getHistoricalEvaluation() {
        mock.calls.push('getHistoricalEvaluation');
        return {
          disclaimer: 'Historical OpenAI evaluation — not executed in this run',
          artifacts: [],
          unavailable: ['baseline-2026-11-15.summary.json'],
        };
      },
    });
    const wrapper = await mountLab(mock);
    expect(wrapper.text()).toContain('No historical summaries available');
    expect(wrapper.text()).toContain('baseline-2026-11-15.summary.json');
  });
});

describe('AppShell navigation', () => {
  it('routes between Workspace and Evaluation Lab', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'workspace', component: WorkspaceView },
        { path: '/evaluation', name: 'evaluation', component: EvaluationLabView },
      ],
    });
    router.push('/');
    await router.isReady();

    const mock = createMockApi();
    const wrapper = mount(AppShell, {
      global: {
        plugins: [router],
        stubs: {
          WorkspaceView: {
            template: '<div>Workspace stub</div>',
            props: ['client'],
          },
          EvaluationLabView: {
            template: '<div>Evaluation stub</div>',
            props: ['client'],
          },
        },
      },
    });

    // Provide client via not needed for stubs
    expect(wrapper.text()).toContain('Workspace');
    expect(wrapper.text()).toContain('Evaluation Lab');

    await router.push('/evaluation');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('evaluation');
    void mock;
  });
});

describe('historical fixture integrity', () => {
  it('sample historical disclaimer matches API contract', () => {
    const h = sampleHistoricalEvaluation();
    expect(h.disclaimer).toBe(
      'Historical OpenAI evaluation — not executed in this run',
    );
    expect(h.artifacts[0]?.metrics.fieldAccuracy.matches).toBe(120);
    expect(h.artifacts[1]?.metrics.fieldAccuracy.total).toBe(244);
  });
});
