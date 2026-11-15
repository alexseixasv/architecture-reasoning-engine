<script setup lang="ts">
import { computed } from 'vue';
import type { EvaluationRunResult } from '@/api/types';
import { checkKindLabel, formatDurationMs } from '@/lib/evaluationFormat';

const props = defineProps<{
  run: EvaluationRunResult;
}>();

const allCases = computed(() => props.run.suites.flatMap((s) => s.cases));

const distribution = computed(() => {
  const total = props.run.summary.total || 1;
  return [
    {
      key: 'passed',
      label: 'Passed',
      count: props.run.summary.passed,
      pct: (100 * props.run.summary.passed) / total,
      fill: 'var(--color-success)',
    },
    {
      key: 'failed',
      label: 'Failed',
      count: props.run.summary.failed,
      pct: (100 * props.run.summary.failed) / total,
      fill: 'var(--color-danger)',
    },
    {
      key: 'skipped',
      label: 'Skipped',
      count: props.run.summary.skipped,
      pct: (100 * props.run.summary.skipped) / total,
      fill: 'var(--color-ink-subtle)',
    },
  ];
});

const maxSuiteDuration = computed(() =>
  Math.max(1, ...props.run.suites.map((s) => s.durationMs)),
);

const byCheckKind = computed(() => {
  const map = new Map<string, number>();
  for (const c of allCases.value) {
    map.set(c.checkKind, (map.get(c.checkKind) ?? 0) + 1);
  }
  return [...map.entries()].map(([kind, count]) => ({
    kind,
    label: checkKindLabel(kind as (typeof allCases.value)[0]['checkKind']),
    count,
  }));
});
</script>

<template>
  <section
    class="rounded-lg border border-border bg-panel p-4"
    aria-labelledby="analytics-heading"
  >
    <h2 id="analytics-heading" class="text-sm font-semibold text-ink">
      Visual analytics
    </h2>
    <p class="mt-1 text-xs text-ink-muted">
      Case coverage of allowlisted deterministic fixtures — not full system correctness
      or LLM accuracy.
    </p>

    <div class="mt-4 grid gap-6 lg:grid-cols-2">
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Pass / fail / skipped
        </h3>
        <div
          class="mt-2 flex h-4 overflow-hidden rounded-full border border-border bg-panel-muted"
          role="img"
          :aria-label="`Passed ${run.summary.passed}, failed ${run.summary.failed}, skipped ${run.summary.skipped}`"
        >
          <div
            v-for="seg in distribution"
            :key="seg.key"
            :style="{ width: `${seg.pct}%`, background: seg.fill }"
            :title="`${seg.label}: ${seg.count}`"
          />
        </div>
        <ul class="mt-2 space-y-1 text-xs text-ink-muted">
          <li v-for="seg in distribution" :key="seg.key" class="flex justify-between">
            <span>{{ seg.label }}</span>
            <span class="font-mono">{{ seg.count }} ({{ seg.pct.toFixed(0) }}%)</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Results by suite
        </h3>
        <ul class="mt-2 space-y-2">
          <li
            v-for="suite in run.suites"
            :key="suite.suiteId"
            class="rounded-md border border-border bg-panel-muted px-3 py-2 text-xs"
          >
            <div class="flex justify-between font-medium text-ink">
              <span class="font-mono">{{ suite.suiteId }}</span>
              <span>
                {{ suite.passed }}P / {{ suite.failed }}F / {{ suite.skipped }}S
              </span>
            </div>
          </li>
        </ul>
      </div>

      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Duration by suite
        </h3>
        <ul class="mt-2 space-y-2">
          <li v-for="suite in run.suites" :key="`dur-${suite.suiteId}`">
            <div class="mb-1 flex justify-between text-xs text-ink-muted">
              <span class="font-mono">{{ suite.suiteId }}</span>
              <span class="font-mono">{{ formatDurationMs(suite.durationMs) }}</span>
            </div>
            <div class="h-2 rounded-full bg-panel-muted">
              <div
                class="h-2 rounded-full bg-accent"
                :style="{
                  width: `${(100 * suite.durationMs) / maxSuiteDuration}%`,
                }"
              />
            </div>
          </li>
        </ul>
      </div>

      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Evaluation category coverage
        </h3>
        <ul class="mt-2 space-y-1 text-xs">
          <li
            v-for="row in byCheckKind"
            :key="row.kind"
            class="flex justify-between gap-2 border-b border-border py-1 text-ink-muted last:border-0"
          >
            <span>{{ row.label }}</span>
            <span class="font-mono text-ink">{{ row.count }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
