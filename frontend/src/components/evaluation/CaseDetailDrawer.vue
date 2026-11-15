<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import type { EvaluationCaseResult } from '@/api/types';
import {
  checkKindLabel,
  formatDurationMs,
  prettyJson,
} from '@/lib/evaluationFormat';

const props = defineProps<{
  caseResult: EvaluationCaseResult | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const open = computed(() => props.caseResult !== null);

const isSchemaOnly = computed(
  () => props.caseResult?.checkKind === 'schema_validation',
);
const isNlIsolation = computed(
  () => props.caseResult?.checkKind === 'nl_isolation_check',
);

const metricEvidence = computed(
  () => props.caseResult?.evidence.metricEvidence ?? [],
);

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) {
    emit('close');
  }
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));

watch(open, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : '';
});
</script>

<template>
  <div
    v-if="caseResult"
    class="print:hidden fixed inset-0 z-40 flex justify-end"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="`case-detail-${caseResult.caseId}`"
  >
    <button
      type="button"
      class="absolute inset-0 bg-ink/40"
      aria-label="Close case detail"
      @click="emit('close')"
    />
    <aside
      class="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-panel shadow-xl"
    >
      <header class="sticky top-0 z-10 border-b border-border bg-panel px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-wide text-ink-subtle">
              Case detail · {{ caseResult.suiteId }}
            </p>
            <h2
              :id="`case-detail-${caseResult.caseId}`"
              class="font-mono text-lg font-semibold text-ink"
            >
              {{ caseResult.caseId }}
            </h2>
            <p class="mt-1 text-sm text-ink-muted">{{ caseResult.description }}</p>
          </div>
          <button
            type="button"
            class="rounded-md border border-border px-2 py-1 text-sm text-ink-muted hover:bg-panel-muted"
            @click="emit('close')"
          >
            Close
          </button>
        </div>
      </header>

      <div class="space-y-4 px-4 py-4 text-sm">
        <section class="rounded-md border border-border bg-panel-muted p-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Check semantics
          </h3>
          <p class="mt-1 text-ink">
            <span class="font-semibold">{{ checkKindLabel(caseResult.checkKind) }}</span>
            · {{ caseResult.status }} · {{ formatDurationMs(caseResult.durationMs) }}
          </p>
          <p class="mt-2 text-xs text-ink-muted">{{ caseResult.verifies }}</p>
          <p
            v-if="isNlIsolation"
            class="mt-2 rounded border border-warning bg-warning-tint px-2 py-1 text-xs text-warning"
            role="note"
          >
            ADV-08 is a deterministic NL isolation check. It does not prove LLM
            prompt-injection resistance.
          </p>
          <p
            v-if="isSchemaOnly"
            class="mt-2 rounded border border-info bg-info-tint px-2 py-1 text-xs text-info"
            role="note"
          >
            Schema-only case — no simulation was executed for this check.
          </p>
          <p
            v-if="caseResult.failureReason"
            class="mt-2 rounded border border-danger bg-danger-tint px-2 py-1 text-xs text-danger"
          >
            Failure: {{ caseResult.failureReason }}
          </p>
        </section>

        <section v-if="caseResult.mismatches.length">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Comparison mismatches
          </h3>
          <ul class="mt-2 space-y-2">
            <li
              v-for="(m, idx) in caseResult.mismatches"
              :key="idx"
              class="rounded border border-danger/40 bg-danger-tint/40 px-2 py-1.5 text-xs"
            >
              <p class="font-mono font-semibold text-danger">{{ m.path }}</p>
              <p class="text-ink">{{ m.message }}</p>
            </li>
          </ul>
        </section>

        <section v-if="metricEvidence.length && !isSchemaOnly">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Metric evidence
          </h3>
          <div class="mt-2 overflow-x-auto">
            <table class="min-w-full border-collapse text-left text-xs">
              <thead>
                <tr class="border-b border-border text-ink-subtle">
                  <th class="px-2 py-1">Metric</th>
                  <th class="px-2 py-1">Expected</th>
                  <th class="px-2 py-1">Actual</th>
                  <th class="px-2 py-1">Formula</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="m in metricEvidence"
                  :key="m.metricId"
                  class="border-b border-border/70"
                >
                  <td class="px-2 py-1 font-mono">{{ m.metricId }}</td>
                  <td class="px-2 py-1 font-mono">{{ m.expectedValue }}</td>
                  <td class="px-2 py-1 font-mono">{{ m.actualValue ?? '—' }}</td>
                  <td class="px-2 py-1 font-mono">{{ m.formulaId ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <details
            v-for="m in metricEvidence"
            :key="`sub-${m.metricId}`"
            class="mt-2 rounded border border-border bg-panel-muted px-2 py-1"
          >
            <summary class="cursor-pointer font-mono text-xs text-ink">
              {{ m.metricId }} substitutions / inputs
            </summary>
            <ul class="mt-1 list-disc pl-4 text-xs text-ink-muted">
              <li v-for="(s, i) in m.substitutions" :key="i">{{ s }}</li>
            </ul>
            <p class="mt-1 font-mono text-[0.7rem] text-ink-subtle">
              inputs: {{ m.inputPaths.join(', ') || '—' }}
            </p>
            <p class="mt-1 font-mono text-[0.7rem] text-ink-subtle">
              result: {{ m.result || '—' }}
            </p>
          </details>
        </section>

        <section>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Evidence summary
          </h3>
          <dl class="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt class="text-ink-subtle">Determinism OK</dt>
              <dd class="font-mono">
                {{
                  caseResult.evidence.determinismOk === undefined
                    ? '—'
                    : String(caseResult.evidence.determinismOk)
                }}
              </dd>
            </div>
            <div>
              <dt class="text-ink-subtle">Formula IDs</dt>
              <dd class="font-mono break-all">
                {{ (caseResult.evidence.formulaIds ?? []).join(', ') || '—' }}
              </dd>
            </div>
            <div class="col-span-2">
              <dt class="text-ink-subtle">Refusal codes</dt>
              <dd class="font-mono break-all">
                {{
                  (caseResult.evidence.refusedReasonCodes ?? []).join(', ') || '—'
                }}
              </dd>
            </div>
            <div
              v-if="caseResult.evidence.notes?.length"
              class="col-span-2"
            >
              <dt class="text-ink-subtle">Notes</dt>
              <dd>
                <ul class="list-disc pl-4 text-ink-muted">
                  <li v-for="(n, i) in caseResult.evidence.notes" :key="i">{{ n }}</li>
                </ul>
              </dd>
            </div>
          </dl>
        </section>

        <details class="rounded border border-border">
          <summary class="cursor-pointer bg-panel-muted px-3 py-2 text-xs font-semibold">
            Input (architecture / scenario)
          </summary>
          <pre class="max-h-64 overflow-auto bg-ink px-3 py-2 font-mono text-[0.7rem] text-ink-on-dark">{{ prettyJson(caseResult.input) }}</pre>
        </details>

        <details class="rounded border border-border">
          <summary class="cursor-pointer bg-panel-muted px-3 py-2 text-xs font-semibold">
            Expected outcome
          </summary>
          <pre class="max-h-64 overflow-auto bg-ink px-3 py-2 font-mono text-[0.7rem] text-ink-on-dark">{{ prettyJson(caseResult.expectedOutcome) }}</pre>
        </details>

        <details class="rounded border border-border">
          <summary class="cursor-pointer bg-panel-muted px-3 py-2 text-xs font-semibold">
            Actual outcome
          </summary>
          <pre class="max-h-64 overflow-auto bg-ink px-3 py-2 font-mono text-[0.7rem] text-ink-on-dark">{{ prettyJson(caseResult.actualOutcome) }}</pre>
        </details>
      </div>
    </aside>
  </div>
</template>
