<script setup lang="ts">
defineProps<{
  modelValue: string;
  loading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  extract: [];
  loadDemo: [];
}>();
</script>

<template>
  <section class="rounded-xl border border-border bg-panel p-4 shadow-sm">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-base font-semibold text-ink">
        Architecture description
      </h2>
      <button
        type="button"
        class="rounded-md border border-border-strong px-2 py-1 text-xs font-semibold text-ink-muted hover:bg-panel-muted"
        @click="emit('loadDemo')"
      >
        Load Fake demo text
      </button>
    </div>
    <label class="block text-xs font-semibold uppercase tracking-wide text-ink-muted" for="architecture-text">
      Natural-language architecture
    </label>
    <textarea
      id="architecture-text"
      class="mt-2 min-h-36 w-full rounded-lg border border-border bg-panel-muted p-3 font-sans text-sm text-ink"
      :value="modelValue"
      :disabled="loading"
      placeholder="Describe components, replicas, capacity, traffic, dependencies…"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="loading || !modelValue.trim()"
        @click="emit('extract')"
      >
        {{ loading ? 'Extracting…' : 'Extract architecture' }}
      </button>
      <p class="text-xs text-ink-subtle">
        Extraction proposes a model only — it does not persist.
      </p>
    </div>
    <p v-if="error" class="mt-3 text-sm text-danger" role="alert">
      {{ error }}
    </p>
  </section>
</template>
