<script setup lang="ts">
import InfoTooltip from '@/components/InfoTooltip.vue';

defineProps<{
  modelValue: string;
  loading: boolean;
  canAnalyze: boolean;
  error: string | null;
  architectureId: string | null;
  version: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  analyze: [];
  loadLoadQuestion: [];
  loadUnsupportedQuestion: [];
}>();
</script>

<template>
  <section class="rounded-xl border border-border bg-panel p-4 shadow-sm">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="flex items-center gap-1.5 text-base font-semibold">
        Scenario analysis
        <InfoTooltip term="scenarioAnalysis" />
        <InfoTooltip term="deterministicSimulation" />
      </h2>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-md border border-border-strong px-2 py-1 text-xs font-semibold text-ink-muted"
          @click="emit('loadLoadQuestion')"
        >
          Demo: utilization @1x
        </button>
        <button
          type="button"
          class="rounded-md border border-border-strong px-2 py-1 text-xs font-semibold text-ink-muted"
          @click="emit('loadUnsupportedQuestion')"
        >
          Demo: availability %
        </button>
      </div>
    </div>
    <p class="mb-2 text-xs text-ink-muted">
      Analyzes exact version
      <span class="font-mono">{{ architectureId ?? '—' }}</span>
      /
      <span class="font-mono">{{ version ?? '—' }}</span>
    </p>
    <label class="block text-xs font-semibold uppercase tracking-wide text-ink-muted" for="question-text">
      Natural-language question
    </label>
    <textarea
      id="question-text"
      class="mt-2 min-h-24 w-full rounded-lg border border-border bg-panel-muted p-3 text-sm"
      :value="modelValue"
      :disabled="loading"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <button
      type="button"
      class="mt-3 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      :disabled="!canAnalyze || loading"
      @click="emit('analyze')"
    >
      {{ loading ? 'Analyzing…' : 'Analyze version' }}
    </button>
    <p v-if="error" class="mt-2 text-sm text-danger" role="alert">
      {{ error }}
    </p>
  </section>
</template>
