<script setup lang="ts">
import type { EvaluationRunResult } from '@/api/types';

const props = defineProps<{
  run: EvaluationRunResult | null;
}>();

function exportJson(): void {
  if (!props.run) return;
  const blob = new Blob([JSON.stringify(props.run, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.run.runId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function printReport(): void {
  window.print();
}
</script>

<template>
  <section
    class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel px-4 py-3 print:hidden"
    aria-label="Report export"
  >
    <p class="text-xs text-ink-muted">
      Export the actual backend run JSON, or print a report view (navigation and
      controls are hidden in print CSS).
    </p>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-panel-muted disabled:opacity-50"
        :disabled="!run"
        @click="exportJson"
      >
        Export JSON
      </button>
      <button
        type="button"
        class="rounded-md border border-accent bg-accent-tint px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
        :disabled="!run"
        @click="printReport"
      >
        Print report
      </button>
    </div>
  </section>
</template>
