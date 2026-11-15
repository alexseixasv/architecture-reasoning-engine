import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/api/client';
import WorkspaceView from '@/pages/WorkspaceView.vue';
import { createMockApi, sampleDocument } from './helpers/mockApi';

describe('WorkspaceView core workflow', () => {
  it('extracts via the extract endpoint and never auto-persists', async () => {
    const mock = createMockApi();
    const wrapper = mount(WorkspaceView, {
      props: { client: mock },
    });

    await wrapper.get('#architecture-text').setValue(
      'The API service runs 4 replicas, each handling 80 requests per second. 80 rps.',
    );
    await wrapper.get('button').trigger('click'); // first primary may be Load demo — find Extract
    const extractBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Extract architecture'));
    expect(extractBtn).toBeTruthy();
    await extractBtn!.trigger('click');
    await flushPromises();

    expect(mock.calls.some((c) => c.startsWith('extract:'))).toBe(true);
    expect(mock.calls.includes('create')).toBe(false);
    expect(wrapper.text()).toContain('Proposed architecture ready for review');
    expect(
      (wrapper.get('#document-json').element as HTMLTextAreaElement).value,
    ).toContain('"id": "api"');
  });

  it('blocks persistence when JSON is invalid', async () => {
    const mock = createMockApi();
    const wrapper = mount(WorkspaceView, { props: { client: mock } });

    const editor = wrapper.get('#document-json');
    await editor.setValue('{ not-json');
    // trigger input handler used by the page
    await editor.trigger('input');

    const saveBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Save architecture'));
    expect(saveBtn?.attributes('disabled')).toBeDefined();

    await saveBtn!.trigger('click');
    await flushPromises();
    expect(mock.calls.includes('create')).toBe(false);
  });

  it('explicit save sends the reviewed document and analyze uses that version', async () => {
    const mock = createMockApi();
    const wrapper = mount(WorkspaceView, { props: { client: mock } });

    await wrapper.get('#architecture-text').setValue('4 replicas 80 requests per second 80 rps');
    const extractBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Extract architecture'));
    await extractBtn!.trigger('click');
    await flushPromises();

    const reviewed = {
      ...sampleDocument(),
      name: 'reviewed-demo',
    };
    await wrapper.get('#document-json').setValue(JSON.stringify(reviewed, null, 2));
    await wrapper.get('#document-json').trigger('input');

    const saveBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Save architecture'));
    await saveBtn!.trigger('click');
    await flushPromises();

    expect(mock.calls.includes('create')).toBe(true);
    expect(wrapper.text()).toContain('arch-test');
    expect(wrapper.text()).toContain('version');

    await wrapper.get('#question-text').setValue(
      'At the current baseline load (1x), what is the API utilization?',
    );
    const analyzeBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Analyze version'));
    await analyzeBtn!.trigger('click');
    await flushPromises();

    expect(
      mock.calls.some((c) => c.startsWith('analyze:arch-test:1:')),
    ).toBe(true);
    expect(wrapper.text()).toContain('utilization:api');
    expect(wrapper.text()).toContain('0.25');
    expect(wrapper.text()).toContain('F-UTIL-001');
  });

  it('displays unsupported scenario results without inventing metrics', async () => {
    const mock = createMockApi();
    const wrapper = mount(WorkspaceView, { props: { client: mock } });

    await wrapper.get('#architecture-text').setValue('4 replicas 80 requests per second 80 rps');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Extract architecture'))!
      .trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Save architecture'))!
      .trigger('click');
    await flushPromises();

    await wrapper.get('#question-text').setValue('What is the availability % if the API fails?');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Analyze version'))!
      .trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('UNSUPPORTED');
    expect(wrapper.text()).toMatch(/Unsupported question/i);
  });

  it('renders null estimated cost honestly', async () => {
    const mock = createMockApi();
    const wrapper = mount(WorkspaceView, { props: { client: mock } });

    await wrapper.get('#architecture-text').setValue('4 replicas 80 requests per second 80 rps');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Extract architecture'))!
      .trigger('click');
    await flushPromises();

    expect(wrapper.text()).toMatch(/n\/a \(pricing incomplete or unavailable\)/i);
    expect(wrapper.text()).toMatch(/not invented/i);
  });

  it('preserves architecture draft when extract fails', async () => {
    const mock = createMockApi({
      async extract() {
        mock.calls.push('extract:fail');
        throw new ApiClientError({
          message: 'Provider unavailable',
          status: 503,
          errorClass: 'PROVIDER_UNAVAILABLE',
        });
      },
    });
    const wrapper = mount(WorkspaceView, { props: { client: mock } });
    const draft =
      'The API service runs 4 replicas, each handling 80 requests per second. 80 rps.';
    await wrapper.get('#architecture-text').setValue(draft);
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Extract architecture'))!
      .trigger('click');
    await flushPromises();

    expect((wrapper.get('#architecture-text').element as HTMLTextAreaElement).value).toBe(
      draft,
    );
    expect(wrapper.text()).toContain('Provider unavailable');
    expect(mock.calls.includes('create')).toBe(false);
  });
});

describe('JsonDocumentEditor persistence gate', () => {
  it('does not call create when JSON is invalid even if clicked', async () => {
    const mock = createMockApi();
    const createSpy = vi.spyOn(mock, 'create');
    const wrapper = mount(WorkspaceView, { props: { client: mock } });
    await wrapper.get('#document-json').setValue('{"broken"');
    await wrapper.get('#document-json').trigger('input');
    const saveBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Save architecture'));
    await saveBtn!.trigger('click');
    await flushPromises();
    expect(createSpy).not.toHaveBeenCalled();
  });
});
