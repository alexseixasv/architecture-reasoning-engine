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
  <section class="rounded-xl border border-border bg-panel p-4 shadow-sm">
    <h2 class="mb-3 text-base font-semibold">Extracted model summary</h2>
    <p v-if="!result" class="text-sm text-ink-subtle">
      Extract an architecture to inspect components, dependencies, and findings.
    </p>
    <template v-else>
      <div class="mb-3 flex flex-wrap gap-2 text-xs">
        <span class="rounded-md bg-accent-tint px-2 py-1 font-semibold text-accent">
          {{ result.status }}
        </span>
        <span class="rounded-md bg-panel-muted px-2 py-1 text-ink-muted">
          canPersist={{ result.canPersist }}
        </span>
      </div>

      <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Components
      </h3>
      <ul class="mt-2 space-y-2">
        <li
          v-for="(node, i) in nodes()"
          :key="i"
          class="rounded-lg border border-border bg-panel-muted p-2 text-sm"
        >
          <p class="font-mono text-xs text-ink">
            {{ (node as { id?: string }).id }} · {{ (node as { kind?: string }).kind }} ·
            {{ (node as { name?: string }).name }}
          </p>
          <p class="mt-1 text-xs text-ink-muted">
            replicas: {{ quantityLabel((node as { replicas?: unknown }).replicas) }} ·
            capacity: {{ quantityLabel((node as { capacityPerReplica?: unknown }).capacityPerReplica) }}
          </p>
        </li>
      </ul>

      <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Dependencies
      </h3>
      <ul v-if="dependencies().length" class="mt-2 space-y-1 text-sm">
        <li
          v-for="(dep, i) in dependencies()"
          :key="i"
          class="font-mono text-xs text-ink-muted"
        >
          {{ (dep as { id?: string }).id }}:
          {{ (dep as { from?: string }).from }} → {{ (dep as { to?: string }).to }}
          ({{ (dep as { communication?: string }).communication }})
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-ink-subtle">None extracted.</p>

      <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Findings
      </h3>
      <ul v-if="result.findings?.length" class="mt-2 space-y-1 text-sm">
        <li v-for="(f, i) in result.findings" :key="i" class="text-ink-muted">
          <span class="font-mono text-xs">{{ f.code }}</span> — {{ f.message }}
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-ink-subtle">No findings.</p>

      <p
        v-if="result.clarificationQuestions?.length"
        class="mt-3 text-sm text-warning"
      >
        Clarifications: {{ result.clarificationQuestions.join(' · ') }}
      </p>
    </template>
  </section>
</template>
