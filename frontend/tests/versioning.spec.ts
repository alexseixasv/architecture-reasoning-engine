import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ApiClientError } from '@/api/client';
import WorkspaceView from '@/pages/WorkspaceView.vue';
import { createMockApi, sampleDocument } from './helpers/mockApi';

async function extractAndSave(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('#architecture-text').setValue(
    'The API service runs 4 replicas, each handling 80 requests per second. 80 rps.',
  );
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
}

describe('version management and OCC', () => {
  it('loads persisted documents by id and selects exact versions', async () => {
    const mock = createMockApi();
    const wrapper = mount(WorkspaceView, { props: { client: mock } });
    await extractAndSave(wrapper);

    const reviewed = { ...sampleDocument('v2-name'), name: 'v2-name' };
    await wrapper.get('#document-json').setValue(JSON.stringify(reviewed, null, 2));
    await wrapper.get('#document-json').trigger('input');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Save as new version'))!
      .trigger('click');
    await flushPromises();

    expect(mock.calls.some((c) => c.startsWith('update:arch-test:1'))).toBe(true);
    expect(wrapper.text()).toContain('v2');

    const openV1 = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Open');
    expect(openV1).toBeTruthy();
    await openV1!.trigger('click');
    await flushPromises();

    expect(mock.calls.some((c) => c === 'getVersion:arch-test:1')).toBe(true);
    expect(wrapper.text()).toMatch(/Editing copy of v1/i);
  });

  it('handles stale expectedVersion with 409 and preserves unsaved edits', async () => {
    const mock = createMockApi();
    const wrapper = mount(WorkspaceView, { props: { client: mock } });
    await extractAndSave(wrapper);

    const unsaved = {
      ...sampleDocument('conflict-draft'),
      name: 'conflict-draft-KEEP',
    };
    const unsavedJson = JSON.stringify(unsaved, null, 2);
    await wrapper.get('#document-json').setValue(unsavedJson);
    await wrapper.get('#document-json').trigger('input');

    mock.forceConflictOnce();
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Save as new version'))!
      .trigger('click');
    await flushPromises();

    expect(wrapper.text()).toMatch(/HTTP 409/i);
    expect(wrapper.text()).toMatch(/version conflict/i);
    expect(
      (wrapper.get('#document-json').element as HTMLTextAreaElement).value,
    ).toContain('conflict-draft-KEEP');
    // No automatic retry with newer expectedVersion
    const updates = mock.calls.filter((c) => c.startsWith('update:'));
    expect(updates).toHaveLength(1);
  });

  it('renders semantic diff changes from the API', async () => {
    const mock = createMockApi();
    const wrapper = mount(WorkspaceView, { props: { client: mock } });
    await extractAndSave(wrapper);

    const reviewed = { ...sampleDocument('after'), name: 'after' };
    await wrapper.get('#document-json').setValue(JSON.stringify(reviewed, null, 2));
    await wrapper.get('#document-json').trigger('input');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Save as new version'))!
      .trigger('click');
    await flushPromises();

    const from = wrapper.get('#diff-from');
    const to = wrapper.get('#diff-to');
    await from.setValue('1');
    await to.setValue('2');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Compare'))!
      .trigger('click');
    await flushPromises();

    expect(mock.calls.some((c) => c === 'diff:arch-test:1:2')).toBe(true);
    expect(wrapper.text()).toMatch(/changed/i);
    expect(wrapper.text()).toContain('name');
  });

  it('normalizes API errors without clearing architecture draft', async () => {
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
    const draft = 'KEEP THIS DRAFT 4 replicas 80 requests per second 80 rps';
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
  });

  it('shows unsupported scenarios and null observability cost', async () => {
    const mock = createMockApi();
    const wrapper = mount(WorkspaceView, { props: { client: mock } });
    await extractAndSave(wrapper);
    await wrapper.get('#question-text').setValue('What is the availability % if API fails?');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Analyze version'))!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('UNSUPPORTED');
    expect(wrapper.text()).toMatch(/n\/a \(pricing incomplete or unavailable\)/i);
  });
});
