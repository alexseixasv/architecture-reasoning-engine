<script setup lang="ts">
import type { AnalyzeHttpResponse } from '@/api/types';
import InfoTooltip from '@/components/InfoTooltip.vue';

defineProps<{
  result: AnalyzeHttpResponse | null;
}>();
</script>

<template>
  <section class="rounded-xl border border-border bg-panel p-4 shadow-sm">
    <h2 class="mb-3 flex items-center gap-1.5 text-base font-semibold">
      Results &amp; evidence
      <InfoTooltip term="deterministicSimulation" />
      <InfoTooltip term="groundedExplanation" />
    </h2>
    <p v-if="!result" class="text-sm text-ink-subtle">
      Run analysis on a persisted version to see deterministic metrics and refusals.
    </p>
    <template v-else>
      <div class="mb-3 flex flex-wrap gap-2 text-xs">
        <span class="rounded-md bg-panel-muted px-2 py-1 font-semibold">
          scenario={{ result.scenarioExtraction.status }}
        </span>
        <span
          v-if="result.simulation"
          class="rounded-md bg-accent-tint px-2 py-1 font-semibold text-accent"
        >
          sim={{ result.simulation.status }}
        </span>
        <span
          v-if="result.explanation"
          class="rounded-md px-2 py-1 font-semibold"
          :class="
            result.explanation.source === 'llm+deterministic'
              ? 'bg-success-tint text-success'
              : 'bg-warning-tint text-warning'
          "
        >
          explain={{ result.explanation.source }}
        </span>
      </div>

      <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Extracted scenario
      </h3>
      <pre class="mt-2 overflow-x-auto rounded-lg bg-panel-muted p-2 font-mono text-xs">{{
        JSON.stringify(
          {
            status: result.scenarioExtraction.status,
            scenario: result.scenarioExtraction.scenario,
            reason: result.scenarioExtraction.reason,
            clarificationQuestions: result.scenarioExtraction.clarificationQuestions,
          },
          null,
          2,
        )
      }}</pre>

      <template v-if="result.scenarioExtraction.status === 'UNSUPPORTED'">
        <p class="mt-3 rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">
          Unsupported question — the engine refused to invent a structured scenario.
          {{ result.scenarioExtraction.reason ?? '' }}
        </p>
      </template>

      <template v-if="result.simulation">
        <h3 class="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Deterministic metrics
          <InfoTooltip term="utilization" />
        </h3>
        <ul class="mt-2 space-y-2">
          <li
            v-for="m in result.simulation.metrics ?? []"
            :key="m.metricId"
            class="rounded-lg border border-border p-2 text-sm"
          >
            <p class="font-mono text-xs">{{ m.metricId }}</p>
            <p class="font-semibold">
              {{ m.value }} <span class="font-normal text-ink-muted">{{ m.unit }}</span>
            </p>
            <p
              v-if="m.formulaId"
              class="inline-flex items-center gap-1 font-mono text-xs text-ink-subtle"
            >
              {{ m.formulaId }}
              <InfoTooltip term="formulaId" />
            </p>
          </li>
        </ul>
        <p
          v-if="!(result.simulation.metrics && result.simulation.metrics.length)"
          class="mt-2 text-sm text-ink-subtle"
        >
          No calculated metrics in this result.
        </p>

        <h3 class="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Refused metrics
          <InfoTooltip term="refusedMetrics" />
        </h3>
        <ul class="mt-2 space-y-2">
          <li
            v-for="r in result.simulation.refused ?? []"
            :key="r.metricId"
            class="rounded-lg border border-warning/30 bg-warning-tint p-2 text-sm"
          >
            <p class="font-mono text-xs">{{ r.metricId }} · {{ r.reasonCode }}</p>
            <p>{{ r.message }}</p>
          </li>
        </ul>

        <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Assumptions
        </h3>
        <ul
          v-if="result.simulation.assumptions && (result.simulation.assumptions as unknown[]).length"
          class="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted"
        >
          <li
            v-for="(a, i) in result.simulation.assumptions as Array<{ id?: string; text?: string }>"
            :key="i"
          >
            <span class="font-mono text-xs">{{ a.id }}</span> — {{ a.text }}
          </li>
        </ul>
        <p v-else class="mt-2 text-sm text-ink-subtle">None listed.</p>
      </template>

      <template v-if="result.explanation">
        <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Explanation
        </h3>
        <div
          class="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-panel-muted p-3 text-sm"
        >
          {{ result.explanation.markdown }}
        </div>
        <p
          v-if="result.explanation.source === 'deterministic_fallback'"
          class="mt-2 text-sm text-warning"
        >
          Deterministic fallback
          <span v-if="result.explanation.validationErrorCodes?.length">
            ({{ result.explanation.validationErrorCodes.join(', ') }})
          </span>
        </p>
      </template>
    </template>
  </section>
</template>
