<script setup lang="ts">
import type { ExtractHttpResponse } from '@/api/types';

const props = defineProps<{
  result: ExtractHttpResponse | null;
}>();

function quantityLabel(q: unknown): string {
  if (!q || typeof q !== 'object') return 'omitted';
  const o = q as { state?: string; value?: number; unit?: string; reason?: string };
  if (o.state === 'known') return `${o.value} ${o.unit ?? ''}`.trim();
  if (o.state === 'unknown') return `unknown${o.reason ? ` (${o.reason})` : ''}`;
  return 'omitted';
}

const nodes = () => {
  const doc = props.result?.document;
  if (!doc || typeof doc !== 'object') return [];
  const n = (doc as { nodes?: unknown[] }).nodes;
  return Array.isArray(n) ? n : [];
};

const dependencies = () => {
  const doc = props.result?.document;
  if (!doc || typeof doc !== 'object') return [];
  const d = (doc as { dependencies?: unknown[] }).dependencies;
  return Array.isArray(d) ? d : [];
};
</script>

<template>
  <section class="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm">
    <h2 class="mb-3 text-base font-semibold">Extracted model summary</h2>
    <p v-if="!result" class="text-sm text-[var(--color-ink-subtle)]">
      Extract an architecture to inspect components, dependencies, and findings.
    </p>
    <template v-else>
      <div class="mb-3 flex flex-wrap gap-2 text-xs">
        <span class="rounded-md bg-[var(--color-accent-tint)] px-2 py-1 font-semibold text-[var(--color-accent)]">
          {{ result.status }}
        </span>
        <span class="rounded-md bg-[var(--color-panel-muted)] px-2 py-1 text-[var(--color-ink-muted)]">
          canPersist={{ result.canPersist }}
        </span>
      </div>

      <h3 class="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
        Components
      </h3>
      <ul class="mt-2 space-y-2">
        <li
          v-for="(node, i) in nodes()"
          :key="i"
          class="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-muted)] p-2 text-sm"
        >
          <p class="font-mono text-xs text-[var(--color-ink)]">
            {{ (node as { id?: string }).id }} · {{ (node as { kind?: string }).kind }} ·
            {{ (node as { name?: string }).name }}
          </p>
          <p class="mt-1 text-xs text-[var(--color-ink-muted)]">
            replicas: {{ quantityLabel((node as { replicas?: unknown }).replicas) }} ·
            capacity: {{ quantityLabel((node as { capacityPerReplica?: unknown }).capacityPerReplica) }}
          </p>
        </li>
      </ul>

      <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
        Dependencies
      </h3>
      <ul v-if="dependencies().length" class="mt-2 space-y-1 text-sm">
        <li
          v-for="(dep, i) in dependencies()"
          :key="i"
          class="font-mono text-xs text-[var(--color-ink-muted)]"
        >
          {{ (dep as { id?: string }).id }}:
          {{ (dep as { from?: string }).from }} → {{ (dep as { to?: string }).to }}
          ({{ (dep as { communication?: string }).communication }})
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-[var(--color-ink-subtle)]">None extracted.</p>

      <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
        Findings
      </h3>
      <ul v-if="result.findings?.length" class="mt-2 space-y-1 text-sm">
        <li v-for="(f, i) in result.findings" :key="i" class="text-[var(--color-ink-muted)]">
          <span class="font-mono text-xs">{{ f.code }}</span> — {{ f.message }}
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-[var(--color-ink-subtle)]">No findings.</p>

      <p
        v-if="result.clarificationQuestions?.length"
        class="mt-3 text-sm text-[var(--color-warning)]"
      >
        Clarifications: {{ result.clarificationQuestions.join(' · ') }}
      </p>
    </template>
  </section>
</template>
