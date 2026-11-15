<script setup lang="ts">
defineProps<{
  modelValue: string;
  jsonError: string | null;
  validateLoading: boolean;
  persistLoading: boolean;
  canValidate: boolean;
  canPersist: boolean;
  isUpdate: boolean;
  expectedVersion: number | null;
  validateError: string | null;
  persistError: string | null;
  architectureId: string | null;
  version: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  validate: [];
  persist: [];
}>();
</script>

<template>
  <section class="rounded-xl border border-border bg-panel p-4 shadow-sm">
    <h2 class="mb-3 text-base font-semibold">Review &amp; correct formal model</h2>
    <label class="block text-xs font-semibold uppercase tracking-wide text-ink-muted" for="document-json">
      Architecture document JSON
    </label>
    <textarea
      id="document-json"
      class="mt-2 min-h-60 w-full rounded-lg border border-border bg-panel-muted p-3 font-mono text-[13px] leading-relaxed text-ink"
      :value="modelValue"
      spellcheck="false"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <p v-if="jsonError" class="mt-2 text-sm text-danger" role="alert">
      JSON error: {{ jsonError }}
    </p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-lg border border-accent px-3.5 py-2 text-sm font-semibold text-accent hover:bg-accent-tint disabled:opacity-50"
        :disabled="!canValidate || validateLoading"
        @click="emit('validate')"
      >
        {{ validateLoading ? 'Validating…' : 'Validate with API' }}
      </button>
      <button
        type="button"
        class="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
        :disabled="!canPersist || persistLoading || Boolean(jsonError)"
        @click="emit('persist')"
      >
        <template v-if="persistLoading">Saving…</template>
        <template v-else-if="isUpdate">
          Save as new version (OCC expected={{ expectedVersion }})
        </template>
        <template v-else>
          Save architecture (create v1)
        </template>
      </button>
    </div>
    <p v-if="validateError" class="mt-2 text-sm text-danger" role="alert">
      {{ validateError }}
    </p>
    <p v-if="persistError" class="mt-2 text-sm text-danger" role="alert">
      {{ persistError }}
    </p>
    <p
      v-if="architectureId && version !== null"
      class="mt-3 rounded-lg bg-success-tint px-3 py-2 text-sm text-success"
    >
      Saved
      <span class="font-mono">{{ architectureId }}</span>
      version
      <span class="font-mono">{{ version }}</span>
    </p>
    <p class="mt-2 text-xs text-ink-subtle">
      Save is always explicit. Extraction never writes to the database. Updates use optimistic concurrency and never auto-retry after 409.
    </p>
  </section>
</template>
