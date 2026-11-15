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
  <section class="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-base font-semibold text-[var(--color-ink)]">
        Architecture description
      </h2>
      <button
        type="button"
        class="rounded-md border border-[var(--color-border-strong)] px-2 py-1 text-xs font-semibold text-[var(--color-ink-muted)] hover:bg-[var(--color-panel-muted)]"
        @click="emit('loadDemo')"
      >
        Load Fake demo text
      </button>
    </div>
    <label class="block text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]" for="architecture-text">
      Natural-language architecture
    </label>
    <textarea
      id="architecture-text"
      class="mt-2 min-h-36 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-muted)] p-3 font-sans text-sm text-[var(--color-ink)]"
      :value="modelValue"
      :disabled="loading"
      placeholder="Describe components, replicas, capacity, traffic, dependencies…"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="loading || !modelValue.trim()"
        @click="emit('extract')"
      >
        {{ loading ? 'Extracting…' : 'Extract architecture' }}
      </button>
      <p class="text-xs text-[var(--color-ink-subtle)]">
        Extraction proposes a model only — it does not persist.
      </p>
    </div>
    <p v-if="error" class="mt-3 text-sm text-[var(--color-danger)]" role="alert">
      {{ error }}
    </p>
  </section>
</template>
