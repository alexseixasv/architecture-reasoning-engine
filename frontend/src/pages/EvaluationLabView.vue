<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { ApiClient } from '@/api/client';
import { api } from '@/api/client';
import type { EvaluationCaseResult } from '@/api/types';
import StatusBanner from '@/components/StatusBanner.vue';
import CaseDetailDrawer from '@/components/evaluation/CaseDetailDrawer.vue';
import EvaluationControls from '@/components/evaluation/EvaluationControls.vue';
import ExecutiveSummary from '@/components/evaluation/ExecutiveSummary.vue';
import HistoricalOpenAiPanel from '@/components/evaluation/HistoricalOpenAiPanel.vue';
import ReportExportBar from '@/components/evaluation/ReportExportBar.vue';
import ResultsTable from '@/components/evaluation/ResultsTable.vue';
import SuiteAnalytics from '@/components/evaluation/SuiteAnalytics.vue';
import { useEvaluation } from '@/composables/useEvaluation';

const props = defineProps<{
  client?: ApiClient;
}>();

const client = props.client ?? api;

const {
  suites,
  selectedSuiteId,
  loadingSuites,
  running,
  loadingHistorical,
  runResult,
  historical,
  runError,
  suitesError,
  historicalError,
  loadSuites,
  runSuite,
  loadHistorical,
} = useEvaluation(client);

const selectedCase = ref<EvaluationCaseResult | null>(null);

onMounted(async () => {
  await Promise.all([loadSuites(), loadHistorical()]);
});

async function onRun(): Promise<void> {
  selectedCase.value = null;
  await runSuite();
}
</script>

<template>
  <div>
    <div class="border-b border-border bg-panel print:border-0">
      <div class="mx-auto max-w-7xl px-4 py-3">
        <p class="text-sm text-ink-muted">
          Deterministic fixture execution versus historical OpenAI evidence —
          kept strictly separate.
        </p>
      </div>
    </div>

    <main class="eval-report mx-auto max-w-7xl space-y-4 px-4 py-6">
      <StatusBanner
        v-if="suitesError"
        :tone="suitesError.kind === 'disabled' ? 'warning' : 'danger'"
        :title="suitesError.title"
        :message="
          suitesError.kind === 'disabled'
            ? `${suitesError.message} Configure EVAL_LAB_ENABLED=1 on the Nest API process and restart.`
            : suitesError.message
        "
      />

      <EvaluationControls
        :suites="suites"
        :selected-suite-id="selectedSuiteId"
        :running="running"
        :loading-suites="loadingSuites"
        :disabled="suitesError?.kind === 'disabled'"
        @update:selected-suite-id="selectedSuiteId = $event"
        @run="onRun"
      />

      <StatusBanner
        v-if="runError"
        :tone="runError.kind === 'disabled' ? 'warning' : 'danger'"
        :title="runError.title"
        :message="
          runError.kind === 'disabled'
            ? `${runError.message} The last successful report below (if any) is preserved.`
            : runError.message
        "
      />

      <StatusBanner
        v-if="running"
        tone="info"
        title="Running evaluation suite"
        message="Calling POST /evaluation/runs — results will replace the previous successful run when complete."
      />

      <StatusBanner
        v-if="runResult && !running && !runError"
        :tone="runResult.overallStatus === 'passed' ? 'success' : 'warning'"
        :title="
          runResult.overallStatus === 'passed'
            ? 'Evaluation completed — all cases passed'
            : 'Evaluation completed — failures present'
        "
        :message="`Suite ${runResult.suiteId}: ${runResult.summary.passed} passed, ${runResult.summary.failed} failed, ${runResult.summary.skipped} skipped.`"
      />

      <template v-if="runResult">
        <ReportExportBar :run="runResult" />
        <ExecutiveSummary :run="runResult" />
        <SuiteAnalytics :run="runResult" />
        <ResultsTable :run="runResult" @select="selectedCase = $event" />
      </template>

      <div
        v-else-if="!running"
        class="rounded-lg border border-dashed border-border-strong bg-panel px-4 py-10 text-center text-sm text-ink-muted"
        role="status"
      >
        No deterministic run yet. Select a suite and click
        <span class="font-semibold text-ink">Run evaluation suite</span>.
      </div>

      <HistoricalOpenAiPanel
        :historical="historical"
        :loading="loadingHistorical"
        :error="historicalError"
      />
    </main>

    <CaseDetailDrawer
      :case-result="selectedCase"
      @close="selectedCase = null"
    />
  </div>
</template>
