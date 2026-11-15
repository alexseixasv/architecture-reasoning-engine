<script setup lang="ts">
import type { UsageSummary } from '@/api/types';
import { formatMs, formatUsd } from '@/lib/format';

defineProps<{
  usage: UsageSummary | null;
  timingsMs?: {
    extractScenario?: number;
    simulate?: number;
    explain?: number;
    total?: number;
  } | null;
}>();
</script>

<template>
  <section class="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm">
    <h2 class="mb-3 text-base font-semibold">Observability</h2>
    <p v-if="!usage" class="text-sm text-[var(--color-ink-subtle)]">
      Usage appears after extract or analyze. Fake LLM costs are often unavailable.
    </p>
    <template v-else>
      <dl class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt class="text-xs text-[var(--color-ink-muted)]">Input tokens</dt>
          <dd class="font-mono font-semibold">{{ usage.totals.inputTokens }}</dd>
        </div>
        <div>
          <dt class="text-xs text-[var(--color-ink-muted)]">Output tokens</dt>
          <dd class="font-mono font-semibold">{{ usage.totals.outputTokens }}</dd>
        </div>
        <div>
          <dt class="text-xs text-[var(--color-ink-muted)]">Est. USD</dt>
          <dd class="font-mono text-xs font-semibold">
            {{ formatUsd(usage.totals.estimatedCostUsd) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-[var(--color-ink-muted)]">Provider ms (sum)</dt>
          <dd class="font-mono font-semibold">{{ formatMs(usage.totals.durationMs) }}</dd>
        </div>
      </dl>
      <p
        v-if="usage.totals.pricingIncomplete || usage.totals.estimatedCostUsd === null"
        class="mt-2 text-xs text-[var(--color-warning)]"
      >
        Estimated cost unavailable (pricing incomplete). This is expected for Fake LLM /
        unknown models — values are not invented.
      </p>
      <ul class="mt-3 space-y-1 text-xs text-[var(--color-ink-muted)]">
        <li v-for="(op, i) in usage.operations" :key="i" class="font-mono">
          {{ op.operation }} · {{ op.model }} · in={{ op.inputTokens }} out={{ op.outputTokens }} ·
          {{ formatUsd(op.estimatedCostUsd) }}
        </li>
      </ul>
    </template>
    <template v-if="timingsMs">
      <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
        Request timings (not architecture latency)
      </h3>
      <ul class="mt-2 space-y-1 font-mono text-xs text-[var(--color-ink-muted)]">
        <li v-if="timingsMs.extractScenario !== undefined">
          extractScenario: {{ formatMs(timingsMs.extractScenario) }}
        </li>
        <li v-if="timingsMs.simulate !== undefined">
          simulate: {{ formatMs(timingsMs.simulate) }}
        </li>
        <li v-if="timingsMs.explain !== undefined">
          explain: {{ formatMs(timingsMs.explain) }}
        </li>
        <li v-if="timingsMs.total !== undefined">total: {{ formatMs(timingsMs.total) }}</li>
      </ul>
    </template>
  </section>
</template>
