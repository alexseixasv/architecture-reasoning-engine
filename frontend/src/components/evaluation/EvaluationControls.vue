<script setup lang="ts">
import type { EvaluationSuiteDescriptor, EvaluationSuiteId } from '@/api/types';

defineProps<{
  suites: EvaluationSuiteDescriptor[];
  selectedSuiteId: EvaluationSuiteId;
  running: boolean;
  loadingSuites: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:selectedSuiteId': [EvaluationSuiteId];
  run: [];
}>();
</script>

<template>
  <section
    class="rounded-lg border border-border bg-panel p-4 print:hidden"
    aria-labelledby="eval-controls-heading"
  >
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-[16rem] flex-1">
        <h2 id="eval-controls-heading" class="text-sm font-semibold text-ink">
          Deterministic evaluation
        </h2>
        <p class="mt-1 text-xs text-ink-muted">
          Runs allowlisted golden, validation, and adversarial fixtures against the
          real engine. No OpenAI calls.
        </p>
        <label class="mt-3 block text-xs font-medium text-ink-muted" for="suite-select">
          Suite
        </label>
        <select
          id="suite-select"
          class="mt-1 w-full max-w-md rounded-md border border-border bg-panel px-3 py-2 text-sm text-ink"
          :value="selectedSuiteId"
          :disabled="running || loadingSuites || disabled"
          @change="
            emit(
              'update:selectedSuiteId',
              ($event.target as HTMLSelectElement).value as EvaluationSuiteId,
            )
          "
        >
          <option
            v-for="suite in suites"
            :key="suite.id"
            :value="suite.id"
          >
            {{ suite.label }} ({{ suite.caseCount }})
          </option>
          <option
            v-if="suites.length === 0"
            value="deterministic_full"
          >
            deterministic_full (default)
          </option>
        </select>
        <p
          v-if="suites.find((s) => s.id === selectedSuiteId)?.description"
          class="mt-1 text-xs text-ink-subtle"
        >
          {{ suites.find((s) => s.id === selectedSuiteId)?.description }}
        </p>
      </div>
      <button
        type="button"
        class="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="running || disabled"
        :aria-busy="running"
        @click="emit('run')"
      >
        {{ running ? 'Running evaluation…' : 'Run evaluation suite' }}
      </button>
    </div>
    <p v-if="running" class="mt-3 text-xs text-ink-muted" role="status">
      Execution in progress — duplicate submits are blocked until this run finishes.
    </p>
  </section>
</template>
