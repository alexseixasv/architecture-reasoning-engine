<script setup lang="ts">
import type { DocumentDiff, VersionListItem } from '@/api/types';
import InfoTooltip from '@/components/InfoTooltip.vue';

defineProps<{
  versions: VersionListItem[];
  fromVersion: number | null;
  toVersion: number | null;
  loading: boolean;
  error: string | null;
  result: DocumentDiff | null;
  disabled: boolean;
}>();

const emit = defineEmits<{
  'update:fromVersion': [value: number | null];
  'update:toVersion': [value: number | null];
  compare: [];
}>();

function onFrom(e: Event): void {
  const v = (e.target as HTMLSelectElement).value;
  emit('update:fromVersion', v === '' ? null : Number(v));
}

function onTo(e: Event): void {
  const v = (e.target as HTMLSelectElement).value;
  emit('update:toVersion', v === '' ? null : Number(v));
}
</script>

<template>
  <section class="rounded-xl border border-border bg-panel p-4 shadow-sm">
    <h2 class="mb-3 flex items-center gap-1.5 text-base font-semibold">
      Semantic diff
      <InfoTooltip term="semanticDiff" />
    </h2>
    <p class="mb-3 text-xs text-ink-muted">
      Compares two persisted versions via the backend. No graph editor.
    </p>
    <div class="flex flex-wrap items-end gap-2">
      <div>
        <label class="block text-xs font-semibold text-ink-muted" for="diff-from">
          From
        </label>
        <select
          id="diff-from"
          class="mt-1 rounded-lg border border-border bg-panel-muted px-2 py-2 font-mono text-sm"
          :value="fromVersion ?? ''"
          :disabled="disabled"
          @change="onFrom"
        >
          <option value="">
            —
          </option>
          <option v-for="v in versions" :key="`from-${v.version}`" :value="v.version">
            v{{ v.version }}
          </option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold text-ink-muted" for="diff-to">
          To
        </label>
        <select
          id="diff-to"
          class="mt-1 rounded-lg border border-border bg-panel-muted px-2 py-2 font-mono text-sm"
          :value="toVersion ?? ''"
          :disabled="disabled"
          @change="onTo"
        >
          <option value="">
            —
          </option>
          <option v-for="v in versions" :key="`to-${v.version}`" :value="v.version">
            v{{ v.version }}
          </option>
        </select>
      </div>
      <button
        type="button"
        class="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        :disabled="disabled || loading || fromVersion === null || toVersion === null"
        @click="emit('compare')"
      >
        {{ loading ? 'Comparing…' : 'Compare' }}
      </button>
    </div>
    <p v-if="error" class="mt-2 text-sm text-danger" role="alert">
      {{ error }}
    </p>
    <template v-if="result">
      <p class="mt-3 text-xs text-ink-muted">
        from={{ result.fromVersion ?? fromVersion }} → to={{ result.toVersion ?? toVersion }} ·
        {{ result.changes.length }} change(s)
      </p>
      <ul v-if="result.changes.length" class="mt-2 max-h-80 space-y-2 overflow-y-auto">
        <li
          v-for="(c, i) in result.changes"
          :key="i"
          class="rounded-lg border border-border bg-panel-muted p-2 text-xs"
        >
          <p class="font-mono font-semibold">
            {{ c.kind }} · {{ c.entityType }} · {{ c.path }}
          </p>
          <pre
            v-if="c.before !== undefined"
            class="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-ink-muted"
          >before: {{ JSON.stringify(c.before, null, 2) }}</pre>
          <pre
            v-if="c.after !== undefined"
            class="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-ink-muted"
          >after: {{ JSON.stringify(c.after, null, 2) }}</pre>
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-ink-subtle">
        No semantic changes between these versions.
      </p>
    </template>
  </section>
</template>
