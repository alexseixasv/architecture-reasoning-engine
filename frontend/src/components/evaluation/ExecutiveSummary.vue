<script setup lang="ts">
import type { EvaluationRunResult } from '@/api/types';
import InfoTooltip from '@/components/InfoTooltip.vue';
import { formatDurationMs } from '@/lib/evaluationFormat';

defineProps<{
  run: EvaluationRunResult;
}>();
</script>

<template>
  <section
    class="rounded-lg border border-border bg-panel p-4"
    aria-labelledby="exec-summary-heading"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2
          id="exec-summary-heading"
          class="inline-flex items-center gap-1.5 text-sm font-semibold text-ink"
        >
          Executive summary
          <InfoTooltip term="deterministicEvaluation" />
        </h2>
        <p class="mt-1 font-mono text-xs text-ink-subtle">
          runId {{ run.runId }}
        </p>
      </div>
      <p
        class="rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
        :class="
          run.overallStatus === 'passed'
            ? 'border-success bg-success-tint text-success'
            : 'border-danger bg-danger-tint text-danger'
        "
        role="status"
      >
        Overall: {{ run.overallStatus }}
      </p>
    </div>

    <dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div class="rounded-md bg-panel-muted px-3 py-2">
        <dt class="text-[0.7rem] uppercase tracking-wide text-ink-subtle">Total</dt>
        <dd class="font-mono text-lg font-semibold text-ink">{{ run.summary.total }}</dd>
      </div>
      <div class="rounded-md bg-panel-muted px-3 py-2">
        <dt class="inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-wide text-ink-subtle">
          Passed
          <InfoTooltip term="casePassed" />
        </dt>
        <dd class="font-mono text-lg font-semibold text-success">{{ run.summary.passed }}</dd>
      </div>
      <div class="rounded-md bg-panel-muted px-3 py-2">
        <dt class="inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-wide text-ink-subtle">
          Failed
          <InfoTooltip term="caseFailed" />
        </dt>
        <dd class="font-mono text-lg font-semibold text-danger">{{ run.summary.failed }}</dd>
      </div>
      <div class="rounded-md bg-panel-muted px-3 py-2">
        <dt class="inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-wide text-ink-subtle">
          Skipped
          <InfoTooltip term="caseSkipped" />
        </dt>
        <dd class="font-mono text-lg font-semibold text-ink-muted">{{ run.summary.skipped }}</dd>
      </div>
      <div class="rounded-md bg-panel-muted px-3 py-2">
        <dt class="text-[0.7rem] uppercase tracking-wide text-ink-subtle">Duration</dt>
        <dd class="font-mono text-lg font-semibold text-ink">
          {{ formatDurationMs(run.summary.durationMs) }}
        </dd>
      </div>
      <div class="rounded-md bg-panel-muted px-3 py-2">
        <dt class="text-[0.7rem] uppercase tracking-wide text-ink-subtle">Executed at</dt>
        <dd class="font-mono text-xs font-semibold text-ink break-all">
          {{ run.executedAt }}
        </dd>
      </div>
    </dl>
    <p class="mt-3 text-xs text-ink-subtle">
      Suite requested: <span class="font-mono">{{ run.suiteId }}</span>.
      Counts come from the backend run response — not from historical OpenAI metrics.
    </p>
  </section>
</template>
