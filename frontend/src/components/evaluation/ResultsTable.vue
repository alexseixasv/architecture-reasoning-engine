<script setup lang="ts">
import { computed, ref } from 'vue';
import type {
  CaseRunStatus,
  EvaluationCaseResult,
  EvaluationCheckKind,
  EvaluationRunResult,
} from '@/api/types';
import {
  checkKindLabel,
  formatDurationMs,
  outcomeLabel,
} from '@/lib/evaluationFormat';

const props = defineProps<{
  run: EvaluationRunResult;
}>();

const emit = defineEmits<{
  select: [EvaluationCaseResult];
}>();

const query = ref('');
const suiteFilter = ref<'all' | EvaluationCaseResult['suiteId']>('all');
const statusFilter = ref<'all' | CaseRunStatus>('all');
const kindFilter = ref<'all' | EvaluationCheckKind>('all');

const allCases = computed(() => props.run.suites.flatMap((s) => s.cases));

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return allCases.value.filter((c) => {
    if (suiteFilter.value !== 'all' && c.suiteId !== suiteFilter.value) {
      return false;
    }
    if (statusFilter.value !== 'all' && c.status !== statusFilter.value) {
      return false;
    }
    if (kindFilter.value !== 'all' && c.checkKind !== kindFilter.value) {
      return false;
    }
    if (!q) return true;
    return (
      c.caseId.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.suiteId.toLowerCase().includes(q) ||
      c.checkKind.toLowerCase().includes(q)
    );
  });
});

const statusClass: Record<CaseRunStatus, string> = {
  passed: 'bg-success-tint text-success border-success',
  failed: 'bg-danger-tint text-danger border-danger',
  skipped: 'bg-panel-muted text-ink-muted border-border-strong',
};
</script>

<template>
  <section
    class="rounded-lg border border-border bg-panel p-4"
    aria-labelledby="results-heading"
  >
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="results-heading" class="text-sm font-semibold text-ink">
          Detailed results
        </h2>
        <p class="mt-1 text-xs text-ink-muted">
          Showing {{ filtered.length }} of {{ allCases.length }} cases from the current run.
        </p>
      </div>
    </div>

    <div class="mt-3 grid gap-2 print:hidden sm:grid-cols-2 lg:grid-cols-4">
      <label class="block text-xs text-ink-muted">
        Search
        <input
          v-model="query"
          type="search"
          class="mt-1 w-full rounded-md border border-border bg-panel px-2 py-1.5 text-sm text-ink"
          placeholder="Case ID, description…"
        >
      </label>
      <label class="block text-xs text-ink-muted">
        Suite
        <select
          v-model="suiteFilter"
          class="mt-1 w-full rounded-md border border-border bg-panel px-2 py-1.5 text-sm"
        >
          <option value="all">All</option>
          <option value="golden">golden</option>
          <option value="validation_formal">validation_formal</option>
          <option value="adversarial">adversarial</option>
        </select>
      </label>
      <label class="block text-xs text-ink-muted">
        Status
        <select
          v-model="statusFilter"
          class="mt-1 w-full rounded-md border border-border bg-panel px-2 py-1.5 text-sm"
        >
          <option value="all">All</option>
          <option value="passed">passed</option>
          <option value="failed">failed</option>
          <option value="skipped">skipped</option>
        </select>
      </label>
      <label class="block text-xs text-ink-muted">
        Check kind
        <select
          v-model="kindFilter"
          class="mt-1 w-full rounded-md border border-border bg-panel px-2 py-1.5 text-sm"
        >
          <option value="all">All</option>
          <option value="simulation_correctness">simulation_correctness</option>
          <option value="schema_validation">schema_validation</option>
          <option value="formal_scenario_validation">formal_scenario_validation</option>
          <option value="adversarial_deterministic">adversarial_deterministic</option>
          <option value="nl_isolation_check">nl_isolation_check</option>
        </select>
      </label>
    </div>

    <div
      v-if="filtered.length === 0"
      class="mt-4 rounded-md border border-dashed border-border-strong bg-panel-muted px-4 py-8 text-center text-sm text-ink-muted"
      role="status"
    >
      No cases match the current filters.
    </div>

    <div v-else class="mt-4 overflow-x-auto">
      <table class="min-w-full border-collapse text-left text-xs">
        <thead>
          <tr class="border-b border-border text-ink-subtle">
            <th scope="col" class="px-2 py-2 font-semibold">Case ID</th>
            <th scope="col" class="px-2 py-2 font-semibold">Suite</th>
            <th scope="col" class="px-2 py-2 font-semibold">Check kind</th>
            <th scope="col" class="px-2 py-2 font-semibold">Description</th>
            <th scope="col" class="px-2 py-2 font-semibold">Expected</th>
            <th scope="col" class="px-2 py-2 font-semibold">Actual</th>
            <th scope="col" class="px-2 py-2 font-semibold">Status</th>
            <th scope="col" class="px-2 py-2 font-semibold">Duration</th>
            <th scope="col" class="px-2 py-2 font-semibold print:hidden">Detail</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in filtered"
            :key="`${c.suiteId}-${c.caseId}`"
            class="border-b border-border/80 hover:bg-panel-muted/80"
          >
            <td class="px-2 py-2 font-mono font-semibold text-ink">{{ c.caseId }}</td>
            <td class="px-2 py-2 font-mono text-ink-muted">{{ c.suiteId }}</td>
            <td class="px-2 py-2 text-ink-muted">{{ checkKindLabel(c.checkKind) }}</td>
            <td class="max-w-56 px-2 py-2 text-ink">{{ c.description }}</td>
            <td class="px-2 py-2 font-mono text-ink-muted">
              {{ outcomeLabel(c.expectedOutcome) }}
            </td>
            <td class="px-2 py-2 font-mono text-ink-muted">
              {{ outcomeLabel(c.actualOutcome) }}
            </td>
            <td class="px-2 py-2">
              <span
                class="inline-block rounded border px-1.5 py-0.5 font-semibold uppercase"
                :class="statusClass[c.status]"
              >
                {{ c.status }}
              </span>
            </td>
            <td class="px-2 py-2 font-mono">{{ formatDurationMs(c.durationMs) }}</td>
            <td class="px-2 py-2 print:hidden">
              <button
                type="button"
                class="text-accent underline-offset-2 hover:underline"
                @click="emit('select', c)"
              >
                Inspect
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
