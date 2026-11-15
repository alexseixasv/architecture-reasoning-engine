<script setup lang="ts">
import { computed, ref } from 'vue';
import type {
  HistoricalCaseSummary,
  HistoricalEvaluationResponse,
  HistoricalSummary,
} from '@/api/types';
import InfoTooltip from '@/components/InfoTooltip.vue';
import {
  formatF1,
  formatPct,
  formatRatio,
  prettyJson,
} from '@/lib/evaluationFormat';
import {
  explainMethodologicalLimitation,
} from '@/lib/glossary';
import type { EvaluationUiError } from '@/composables/useEvaluation';

const props = defineProps<{
  historical: HistoricalEvaluationResponse | null;
  loading: boolean;
  error: EvaluationUiError | null;
}>();

const HISTORICAL_TITLE =
  'Historical OpenAI evaluation — not executed in this run';

const selectedCaseId = ref('');

const baseline = computed(
  () =>
    props.historical?.artifacts.find((a) => a.passLabel === 'baseline') ??
    props.historical?.artifacts[0] ??
    null,
);
const remediation = computed(
  () =>
    props.historical?.artifacts.find((a) => a.passLabel === 'remediation') ??
    props.historical?.artifacts[1] ??
    null,
);

const caseIds = computed(() => {
  const ids = new Set<string>();
  for (const a of props.historical?.artifacts ?? []) {
    for (const c of a.cases) ids.add(c.caseId);
  }
  return [...ids].sort();
});

const historicalArtifacts = computed(() => {
  const list: HistoricalSummary[] = [];
  if (baseline.value) list.push(baseline.value);
  if (remediation.value) list.push(remediation.value);
  return list;
});

function caseFrom(
  artifact: HistoricalSummary | null,
  caseId: string,
): HistoricalCaseSummary | null {
  return artifact?.cases.find((c) => c.caseId === caseId) ?? null;
}

function metricCell(
  artifact: HistoricalSummary | null,
  picker: (m: HistoricalSummary['metrics']) => string,
): string {
  if (!artifact) return '—';
  return picker(artifact.metrics);
}

function limitationCopy(id: string): { title: string; body: string; raw: string } {
  const explained = explainMethodologicalLimitation(id);
  if (explained) {
    return { title: explained.title, body: explained.body, raw: id };
  }
  return {
    title: id,
    body: 'Documented methodological caveat from the sanitized historical artifact.',
    raw: id,
  };
}
</script>

<template>
  <section
    class="rounded-lg border border-border-strong bg-panel p-4"
    aria-labelledby="historical-heading"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2
          id="historical-heading"
          class="inline-flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink"
        >
          {{ HISTORICAL_TITLE }}
          <InfoTooltip term="historicalEvaluation" />
          <InfoTooltip term="baselineVsRemediation" />
        </h2>
        <p class="mt-1 text-xs text-ink-muted">
          Sanitized artifacts from prior measured OpenAI runs. These metrics are
          <strong class="font-semibold">not</strong> included in the current
          deterministic run totals.
        </p>
      </div>
      <p
        class="rounded-md border border-info bg-info-tint px-2 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-info"
        role="note"
      >
        Historical only
      </p>
    </div>

    <p
      v-if="loading"
      class="mt-3 text-sm text-ink-muted"
      role="status"
    >
      Loading historical evidence…
    </p>

    <div
      v-else-if="error"
      class="mt-3 rounded-md border border-danger bg-danger-tint px-3 py-2 text-sm text-danger"
      role="alert"
    >
      <p class="font-semibold">{{ error.title }}</p>
      <p class="mt-1 text-xs">{{ error.message }}</p>
    </div>

    <div
      v-else-if="!historical || historical.artifacts.length === 0"
      class="mt-3 rounded-md border border-dashed border-border-strong bg-panel-muted px-4 py-6 text-sm text-ink-muted"
      role="status"
    >
      No historical summaries available.
      <span v-if="historical?.unavailable?.length">
        Missing: {{ historical.unavailable.join(', ') }}
      </span>
    </div>

    <template v-else>
      <p class="mt-3 text-xs text-ink-subtle">
        Disclaimer from API:
        <span class="font-medium text-ink">{{ historical.disclaimer }}</span>
      </p>

      <div class="mt-4 overflow-x-auto">
        <table class="min-w-full border-collapse text-left text-xs">
          <thead>
            <tr class="border-b border-border text-ink-subtle">
              <th class="px-2 py-2">Metric</th>
              <th class="px-2 py-2">Baseline</th>
              <th class="px-2 py-2">Remediation</th>
            </tr>
          </thead>
          <tbody class="text-ink">
            <tr class="border-b border-border/70">
              <td class="px-2 py-1.5 text-ink-muted">ID / date</td>
              <td class="px-2 py-1.5 font-mono">
                {{ baseline?.id ?? '—' }} · {{ baseline?.evaluationDate ?? '—' }}
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{ remediation?.id ?? '—' }} · {{ remediation?.evaluationDate ?? '—' }}
              </td>
            </tr>
            <tr class="border-b border-border/70">
              <td class="px-2 py-1.5 text-ink-muted">Model / dataset</td>
              <td class="px-2 py-1.5">
                {{ baseline?.model ?? '—' }} · {{ baseline?.dataset ?? '—' }}
              </td>
              <td class="px-2 py-1.5">
                {{ remediation?.model ?? '—' }} · {{ remediation?.dataset ?? '—' }}
              </td>
            </tr>
            <tr class="border-b border-border/70">
              <td class="px-2 py-1.5 text-ink-muted">
                <span class="inline-flex items-center gap-1">
                  Field accuracy
                  <InfoTooltip term="fieldAccuracy" />
                </span>
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{
                  baseline
                    ? `${baseline.metrics.fieldAccuracy.matches}/${baseline.metrics.fieldAccuracy.total} (${formatPct(baseline.metrics.fieldAccuracy.pct)})`
                    : '—'
                }}
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{
                  remediation
                    ? `${remediation.metrics.fieldAccuracy.matches}/${remediation.metrics.fieldAccuracy.total} (${formatPct(remediation.metrics.fieldAccuracy.pct)})`
                    : '—'
                }}
              </td>
            </tr>
            <tr class="border-b border-border/70">
              <td class="px-2 py-1.5 text-ink-muted">
                <span class="inline-flex items-center gap-1">
                  Node F1
                  <InfoTooltip term="nodeF1" />
                </span>
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{ formatF1(baseline?.metrics.node.f1 ?? null) }}
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{ formatF1(remediation?.metrics.node.f1 ?? null) }}
              </td>
            </tr>
            <tr class="border-b border-border/70">
              <td class="px-2 py-1.5 text-ink-muted">
                <span class="inline-flex items-center gap-1">
                  Dependency F1
                  <InfoTooltip term="dependencyF1" />
                </span>
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{ formatF1(baseline?.metrics.dependency.f1 ?? null) }}
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{ formatF1(remediation?.metrics.dependency.f1 ?? null) }}
              </td>
            </tr>
            <tr class="border-b border-border/70">
              <td class="px-2 py-1.5 text-ink-muted">
                <span class="inline-flex items-center gap-1">
                  Scenario structured
                  <InfoTooltip term="scenarioStructured" />
                </span>
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{
                  formatRatio(
                    baseline?.metrics.scenarioStructured.overallOk,
                    baseline?.metrics.scenarioStructured.denominator,
                  )
                }}
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{
                  formatRatio(
                    remediation?.metrics.scenarioStructured.overallOk,
                    remediation?.metrics.scenarioStructured.denominator,
                  )
                }}
              </td>
            </tr>
            <tr class="border-b border-border/70">
              <td class="px-2 py-1.5 text-ink-muted">
                <span class="inline-flex items-center gap-1">
                  Unsupported NL
                  <InfoTooltip term="unsupportedNl" />
                </span>
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{
                  formatRatio(
                    baseline?.metrics.scenarioUnsupportedNl.ok,
                    baseline?.metrics.scenarioUnsupportedNl.denominator,
                  )
                }}
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{
                  formatRatio(
                    remediation?.metrics.scenarioUnsupportedNl.ok,
                    remediation?.metrics.scenarioUnsupportedNl.denominator,
                  )
                }}
              </td>
            </tr>
            <tr class="border-b border-border/70">
              <td class="px-2 py-1.5 text-ink-muted">
                <span class="inline-flex items-center gap-1">
                  Grounded explanation
                  <InfoTooltip term="groundedExplanation" />
                </span>
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{
                  baseline
                    ? `${baseline.metrics.explanation.groundedSuccess}/${baseline.metrics.explanation.evaluated} grounded; ${baseline.metrics.explanation.deterministicFallback} fallback`
                    : '—'
                }}
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{
                  remediation
                    ? `${remediation.metrics.explanation.groundedSuccess}/${remediation.metrics.explanation.evaluated} grounded; ${remediation.metrics.explanation.deterministicFallback} fallback`
                    : '—'
                }}
              </td>
            </tr>
            <tr class="border-b border-border/70">
              <td class="px-2 py-1.5 text-ink-muted">
                <span class="inline-flex items-center gap-1">
                  Est. USD / wall p50·p95
                  <InfoTooltip term="estimatedUsd" />
                  <InfoTooltip term="wallP50P95" />
                </span>
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{
                  metricCell(baseline, (m) =>
                    m.estimatedUsd === null
                      ? '—'
                      : `~$${m.estimatedUsd} / ${m.wallMs.p50}·${m.wallMs.p95} ms (N=${m.wallMs.sampleSize})`,
                  )
                }}
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{
                  metricCell(remediation, (m) =>
                    m.estimatedUsd === null
                      ? '—'
                      : `~$${m.estimatedUsd} / ${m.wallMs.p50}·${m.wallMs.p95} ms (N=${m.wallMs.sampleSize})`,
                  )
                }}
              </td>
            </tr>
            <tr class="border-b border-border/70">
              <td class="px-2 py-1.5 text-ink-muted">
                <span class="inline-flex items-center gap-1">
                  Tokens in/out
                  <InfoTooltip term="tokensInOut" />
                </span>
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{
                  baseline?.metrics.tokens
                    ? `${baseline.metrics.tokens.input} / ${baseline.metrics.tokens.output}`
                    : '—'
                }}
              </td>
              <td class="px-2 py-1.5 font-mono">
                {{
                  remediation?.metrics.tokens
                    ? `${remediation.metrics.tokens.input} / ${remediation.metrics.tokens.output}`
                    : '—'
                }}
              </td>
            </tr>
            <tr class="border-b border-border/70">
              <td class="px-2 py-1.5 text-ink-muted">
                <span class="inline-flex items-center gap-1">
                  Source SHA-256
                  <InfoTooltip term="sourceSha256" />
                </span>
              </td>
              <td class="px-2 py-1.5 font-mono break-all text-[0.65rem]">
                {{ baseline?.sourceArtifactSha256 ?? '—' }}
              </td>
              <td class="px-2 py-1.5 font-mono break-all text-[0.65rem]">
                {{ remediation?.sourceArtifactSha256 ?? '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="mt-3 rounded-md border border-warning bg-warning-tint px-3 py-2 text-xs text-warning">
        Field accuracy denominators differ between passes (235 vs 244). Treat the
        percentage comparison as directional only; prefer Node/Dep F1 and scenario
        metrics when comparing.
      </p>

      <div class="mt-4">
        <h3 class="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Methodological limitations
          <InfoTooltip term="methodologicalLimitations" />
        </h3>
        <ul class="mt-2 space-y-2 text-xs text-ink-muted">
          <li
            v-for="(lim, i) in [
              ...new Set(
                (historical.artifacts ?? []).flatMap((a) => a.limitations ?? []),
              ),
            ]"
            :key="i"
            class="rounded-md border border-border bg-panel-muted px-3 py-2"
          >
            <p class="font-semibold text-ink">
              {{ limitationCopy(lim).title }}
            </p>
            <p class="mt-1">{{ limitationCopy(lim).body }}</p>
            <p class="mt-1 font-mono text-[0.65rem] text-ink-subtle">
              id: {{ limitationCopy(lim).raw }}
            </p>
          </li>
        </ul>
      </div>

      <div class="mt-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Per-case historical drill-down (V01–V12)
        </h3>
        <label class="mt-2 block text-xs text-ink-muted print:hidden">
          Case
          <select
            v-model="selectedCaseId"
            class="mt-1 rounded-md border border-border bg-panel px-2 py-1.5 text-sm"
          >
            <option value="">Select a case…</option>
            <option v-for="id in caseIds" :key="id" :value="id">{{ id }}</option>
          </select>
        </label>

        <div
          v-if="selectedCaseId"
          class="mt-3 grid gap-3 lg:grid-cols-2"
        >
          <article
            v-for="art in historicalArtifacts"
            :key="art.id"
            class="rounded-md border border-border bg-panel-muted p-3 text-xs"
          >
            <h4 class="font-semibold text-ink">
              {{ art.passLabel }} · {{ selectedCaseId }}
            </h4>
            <template v-if="caseFrom(art, selectedCaseId)">
              <dl class="mt-2 space-y-1 text-ink-muted">
                <div class="flex justify-between gap-2">
                  <dt>Pipeline failure</dt>
                  <dd class="font-mono text-ink">
                    {{ caseFrom(art, selectedCaseId)!.pipelineFailureClass }}
                  </dd>
                </div>
                <div class="flex justify-between gap-2">
                  <dt>Field accuracy</dt>
                  <dd class="font-mono text-ink">
                    {{
                      caseFrom(art, selectedCaseId)!.fieldAccuracy
                        ? `${caseFrom(art, selectedCaseId)!.fieldAccuracy!.matches}/${caseFrom(art, selectedCaseId)!.fieldAccuracy!.total}`
                        : '—'
                    }}
                  </dd>
                </div>
                <div class="flex justify-between gap-2">
                  <dt>Scenario overall</dt>
                  <dd class="font-mono text-ink">
                    {{
                      caseFrom(art, selectedCaseId)!.scenarioCompare
                        ? String(
                          caseFrom(art, selectedCaseId)!.scenarioCompare!
                            .overallMatch,
                        )
                        : '—'
                    }}
                  </dd>
                </div>
                <div class="flex justify-between gap-2">
                  <dt>Explanation</dt>
                  <dd class="font-mono text-ink">
                    {{
                      caseFrom(art, selectedCaseId)!.explanationSource ?? '—'
                    }}
                  </dd>
                </div>
              </dl>
              <details class="mt-2">
                <summary class="cursor-pointer text-accent">Raw case JSON</summary>
                <pre class="mt-1 max-h-40 overflow-auto bg-ink p-2 font-mono text-[0.65rem] text-ink-on-dark">{{ prettyJson(caseFrom(art, selectedCaseId)) }}</pre>
              </details>
            </template>
            <p v-else class="mt-2 text-ink-subtle">No per-case evidence in this artifact.</p>
          </article>
        </div>
      </div>
    </template>
  </section>
</template>
