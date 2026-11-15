import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import InfoTooltip from '@/components/InfoTooltip.vue';
import HistoricalOpenAiPanel from '@/components/evaluation/HistoricalOpenAiPanel.vue';
import VersionPanel from '@/components/VersionPanel.vue';
import {
  GLOSSARY,
  METHODOLOGICAL_LIMITATIONS,
  explainMethodologicalLimitation,
} from '@/lib/glossary';
import { sampleHistoricalEvaluation } from './helpers/mockApi';

describe('glossary', () => {
  it('covers required technical terms with non-empty explanations', () => {
    const required = [
      'fieldAccuracy',
      'nodeF1',
      'dependencyF1',
      'unsupportedNl',
      'optimisticConcurrency',
      'expectedVersion',
      'deterministicSimulation',
      'historicalEvaluation',
      'nlIsolationCheck',
      'schemaValidation',
    ] as const;
    for (const term of required) {
      expect(GLOSSARY[term].title.length).toBeGreaterThan(2);
      expect(GLOSSARY[term].body.length).toBeGreaterThan(40);
    }
  });

  it('maps methodological limitation ids to human-readable copy', () => {
    for (const id of Object.keys(METHODOLOGICAL_LIMITATIONS)) {
      const entry = explainMethodologicalLimitation(id);
      expect(entry).not.toBeNull();
      expect(entry!.title).not.toBe(id);
      expect(entry!.body.length).toBeGreaterThan(20);
    }
    expect(
      explainMethodologicalLimitation('denominator_change_between_passes')?.body,
    ).toMatch(/directional/i);
  });
});

describe('InfoTooltip', () => {
  it('renders accessible trigger and shows glossary content on click', async () => {
    const wrapper = mount(InfoTooltip, {
      props: { term: 'fieldAccuracy' },
      attachTo: document.body,
    });

    const btn = wrapper.get('button');
    expect(btn.attributes('aria-label')).toContain('Field accuracy');
    expect(btn.attributes('aria-expanded')).toBe('false');

    await btn.trigger('click');
    await nextTick();

    expect(btn.attributes('aria-expanded')).toBe('true');
    const tip = document.getElementById('info-tooltip-fieldAccuracy');
    expect(tip?.textContent).toContain(GLOSSARY.fieldAccuracy.title);
    expect(tip?.textContent).toContain('correct');
    expect(tip?.getAttribute('role')).toBe('tooltip');

    wrapper.unmount();
  });

  it('opens on focus and dismisses on Escape', async () => {
    const wrapper = mount(InfoTooltip, {
      props: { term: 'optimisticConcurrency' },
      attachTo: document.body,
    });

    const btn = wrapper.get('button');
    await btn.trigger('focus');
    await nextTick();
    expect(document.getElementById('info-tooltip-optimisticConcurrency')).toBeTruthy();
    expect(
      document.getElementById('info-tooltip-optimisticConcurrency')?.textContent,
    ).toContain('HTTP 409');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(btn.attributes('aria-expanded')).toBe('false');

    wrapper.unmount();
  });

  it('opens on mouseenter (hover)', async () => {
    const wrapper = mount(InfoTooltip, {
      props: { term: 'nodeF1' },
      attachTo: document.body,
    });

    await wrapper.get('button').trigger('mouseenter');
    await nextTick();
    expect(document.body.textContent).toContain(GLOSSARY.nodeF1.body.slice(0, 40));

    wrapper.unmount();
  });
});

describe('contextual explanations in panels', () => {
  it('explains OCC expectedVersion in the Workspace version panel', async () => {
    const wrapper = mount(VersionPanel, {
      props: {
        loadIdInput: '',
        architectureId: 'arch-1',
        version: 2,
        expectedVersion: 2,
        versions: [],
        versionsLoading: false,
        loadError: null,
        conflict: null,
      },
      attachTo: document.body,
    });

    const tipBtn = wrapper
      .findAll('button')
      .find((b) => b.attributes('aria-label')?.includes('expectedVersion'));
    expect(tipBtn).toBeTruthy();
    await tipBtn!.trigger('click');
    await nextTick();
    expect(document.body.textContent).toContain('OCC token sent on PUT');

    wrapper.unmount();
  });

  it('renders human methodological caveats while preserving raw ids', async () => {
    const wrapper = mount(HistoricalOpenAiPanel, {
      props: {
        historical: sampleHistoricalEvaluation(),
        loading: false,
        error: null,
      },
      attachTo: document.body,
    });

    expect(wrapper.text()).toContain('Denominator change between passes');
    expect(wrapper.text()).toContain('denominator_change_between_passes');
    expect(wrapper.text()).toContain('Formal-context scenario scoring');
    expect(wrapper.text()).toContain('formal_context_scenario_scoring');
    expect(wrapper.text()).toContain('Estimated USD ≠ invoice');
    expect(wrapper.text()).toContain('estimated_usd_not_invoice');

    const fieldTip = wrapper
      .findAll('button')
      .find((b) => b.attributes('aria-label')?.includes('Field accuracy'));
    expect(fieldTip).toBeTruthy();
    await fieldTip!.trigger('click');
    await nextTick();
    expect(document.body.textContent).toMatch(/not a generalization estimate/i);

    wrapper.unmount();
  });
});
