<script setup lang="ts">
import type { VersionConflictInfo, VersionListItem } from '@/api/types';

defineProps<{
  loadIdInput: string;
  architectureId: string | null;
  version: number | null;
  expectedVersion: number | null;
  versions: VersionListItem[];
  versionsLoading: boolean;
  loadError: string | null;
  conflict: VersionConflictInfo | null;
}>();

const emit = defineEmits<{
  'update:loadIdInput': [value: string];
  load: [];
  selectVersion: [version: number];
  reloadLatest: [];
}>();
</script>

<template>
  <section class="rounded-xl border border-border bg-panel p-4 shadow-sm">
    <h2 class="mb-3 text-base font-semibold">
      Versions &amp; optimistic concurrency
    </h2>

    <label
      class="block text-xs font-semibold uppercase tracking-wide text-ink-muted"
      for="arch-id-input"
    >
      Architecture ID
    </label>
    <div class="mt-2 flex flex-wrap gap-2">
      <input
        id="arch-id-input"
        class="min-w-[16rem] flex-1 rounded-lg border border-border bg-panel-muted px-3 py-2 font-mono text-sm"
        :value="loadIdInput"
        placeholder="Paste architectureId to load"
        @input="emit('update:loadIdInput', ($event.target as HTMLInputElement).value)"
      >
      <button
        type="button"
        class="rounded-lg border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent-tint disabled:opacity-50"
        :disabled="versionsLoading || !loadIdInput.trim()"
        @click="emit('load')"
      >
        {{ versionsLoading ? 'Loading…' : 'Load latest' }}
      </button>
    </div>

    <p v-if="loadError" class="mt-2 text-sm text-danger" role="alert">
      {{ loadError }}
    </p>

    <dl class="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
      <div>
        <dt class="text-xs text-ink-muted">Selected version</dt>
        <dd class="font-mono font-semibold">{{ version ?? '—' }}</dd>
      </div>
      <div>
        <dt class="text-xs text-ink-muted">expectedVersion (OCC)</dt>
        <dd class="font-mono font-semibold">{{ expectedVersion ?? '—' }}</dd>
      </div>
      <div>
        <dt class="text-xs text-ink-muted">Architecture</dt>
        <dd class="truncate font-mono text-xs">{{ architectureId ?? '—' }}</dd>
      </div>
    </dl>

    <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
      Available versions
    </h3>
    <ul v-if="versions.length" class="mt-2 space-y-1">
      <li
        v-for="v in versions"
        :key="v.version"
        class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-panel-muted px-2 py-1.5 text-sm"
      >
        <span class="font-mono text-xs">
          v{{ v.version }} · {{ v.changeSource }} · {{ v.createdAt }}
        </span>
        <button
          type="button"
          class="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          :disabled="version === v.version"
          @click="emit('selectVersion', v.version)"
        >
          {{ version === v.version ? 'Selected' : 'Open' }}
        </button>
      </li>
    </ul>
    <p v-else class="mt-2 text-sm text-ink-subtle">
      Persist an architecture or load by ID to list versions.
    </p>

    <div
      v-if="conflict"
      class="mt-4 rounded-lg border border-danger bg-danger-tint p-3 text-sm text-danger"
      role="alert"
    >
      <p class="font-semibold">HTTP 409 — version conflict</p>
      <p class="mt-1">{{ conflict.message }}</p>
      <p class="mt-1 font-mono text-xs">
        expected={{ conflict.expectedVersion ?? '—' }} ·
        actual={{ conflict.actualVersion ?? '—' }}
      </p>
      <p class="mt-2 text-ink">
        Your unsaved JSON edits were preserved. Reloading latest will replace the editor with the server document — it will not retry the update automatically.
      </p>
      <button
        type="button"
        class="mt-3 rounded-lg border border-danger px-3 py-1.5 text-xs font-semibold"
        @click="emit('reloadLatest')"
      >
        Reload latest version into editor
      </button>
    </div>
  </section>
</template>
