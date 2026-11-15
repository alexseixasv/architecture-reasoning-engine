<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ApiClient } from '@/api/client';
import { api } from '@/api/client';
import type { UsageSummary } from '@/api/types';
import ArchitectureInputPanel from '@/components/ArchitectureInputPanel.vue';
import DiffViewer from '@/components/DiffViewer.vue';
import ExtractedModelPanel from '@/components/ExtractedModelPanel.vue';
import JsonDocumentEditor from '@/components/JsonDocumentEditor.vue';
import ResultsEvidencePanel from '@/components/ResultsEvidencePanel.vue';
import ScenarioPanel from '@/components/ScenarioPanel.vue';
import StatusBanner from '@/components/StatusBanner.vue';
import UsageTimingPanel from '@/components/UsageTimingPanel.vue';
import VersionPanel from '@/components/VersionPanel.vue';
import { useAnalysis } from '@/composables/useAnalysis';
import { useArchitectureSession } from '@/composables/useArchitectureSession';
import { useDiff } from '@/composables/useDiff';
import { useExtraction } from '@/composables/useExtraction';
import {
  DEMO_ARCHITECTURE_TEXT,
  DEMO_QUESTION_LOAD,
  DEMO_QUESTION_UNSUPPORTED,
} from '@/lib/demoFixtures';

const props = defineProps<{
  client?: ApiClient;
}>();

const client = props.client ?? api;

const {
  architectureText,
  loading: extractLoading,
  error: extractError,
  result: extractResult,
  usage: extractUsage,
  extract,
} = useExtraction(client);

const {
  documentJson,
  jsonError,
  validateLoading,
  validateError,
  architectureId,
  version,
  expectedVersion,
  versions,
  versionsLoading,
  loadError,
  loadIdInput,
  persistLoading,
  persistError,
  conflict,
  canValidate,
  canPersist,
  isUpdate,
  findings,
  setDocumentFromUnknown,
  onDocumentJsonInput,
  validateDocument,
  persist,
  loadById,
  selectVersion,
  reloadLatestAfterConflict,
} = useArchitectureSession(client);

const {
  question,
  loading: analyzeLoading,
  error: analyzeError,
  result: analyzeResult,
  usage: analyzeUsage,
  canAnalyze,
  analyze,
} = useAnalysis(architectureId, version, client);

const {
  fromVersion,
  toVersion,
  loading: diffLoading,
  error: diffError,
  result: diffResult,
  compare,
} = useDiff(architectureId, client);

const banner = ref<{
  tone: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message?: string;
} | null>(null);

const latestUsage = computed<UsageSummary | null>(() => {
  return analyzeUsage.value ?? extractUsage.value ?? null;
});

async function onExtract(): Promise<void> {
  banner.value = null;
  const draftBefore = architectureText.value;
  const response = await extract();
  if (!response) {
    architectureText.value = draftBefore;
    banner.value = {
      tone: 'danger',
      title: 'Extraction failed',
      message: extractError.value ?? 'Unknown error',
    };
    return;
  }
  if (response.status === 'PROPOSED' && response.document) {
    setDocumentFromUnknown(response.document);
    banner.value = {
      tone: 'success',
      title: 'Proposed architecture ready for review',
      message: 'Not persisted. Validate and save explicitly when ready.',
    };
  } else {
    banner.value = {
      tone: 'warning',
      title: 'Extraction did not propose a document',
      message: response.message ?? response.errorClass ?? response.status,
    };
  }
}

async function onValidate(): Promise<void> {
  banner.value = null;
  const draftBefore = documentJson.value;
  const response = await validateDocument();
  if (!response) {
    documentJson.value = draftBefore;
    banner.value = {
      tone: 'danger',
      title: 'Validation failed',
      message: validateError.value ?? undefined,
    };
    return;
  }
  const errors = (response.findings ?? []).filter((f) => f.severity === 'ERROR');
  banner.value = {
    tone: response.canPersist === false || errors.length ? 'warning' : 'success',
    title:
      response.canPersist === false
        ? 'Document cannot be persisted yet'
        : 'Validation completed',
    message: `${response.findings?.length ?? 0} finding(s); canPersist=${String(response.canPersist)}`,
  };
}

async function onPersist(): Promise<void> {
  banner.value = null;
  const savingUpdate = isUpdate.value;
  const envelope = await persist();
  if (!envelope) {
    if (conflict.value) {
      banner.value = {
        tone: 'danger',
        title: 'HTTP 409 — version conflict',
        message:
          'Unsaved edits preserved. Reload latest only if you choose to discard them.',
      };
      return;
    }
    banner.value = {
      tone: 'danger',
      title: 'Save failed',
      message: persistError.value ?? undefined,
    };
    return;
  }
  banner.value = {
    tone: 'success',
    title: savingUpdate ? 'New version saved' : 'Architecture created',
    message: `${envelope.architectureId} @ v${envelope.version}`,
  };
  if (fromVersion.value === null) {
    fromVersion.value = Math.max(1, envelope.version - 1);
  }
  toVersion.value = envelope.version;
}

async function onLoad(): Promise<void> {
  banner.value = null;
  const envelope = await loadById();
  if (!envelope) {
    banner.value = {
      tone: 'danger',
      title: 'Load failed',
      message: loadError.value ?? undefined,
    };
    return;
  }
  banner.value = {
    tone: 'success',
    title: 'Architecture loaded',
    message: `${envelope.architectureId} @ v${envelope.version}`,
  };
}

async function onSelectVersion(target: number): Promise<void> {
  banner.value = null;
  const envelope = await selectVersion(target);
  if (!envelope) {
    banner.value = {
      tone: 'danger',
      title: 'Version load failed',
      message: loadError.value ?? undefined,
    };
    return;
  }
  banner.value = {
    tone: 'info',
    title: `Editing copy of v${envelope.version}`,
    message: `OCC expectedVersion=${envelope.version}. Saving creates a new immutable version.`,
  };
}

async function onReloadLatest(): Promise<void> {
  banner.value = null;
  const envelope = await reloadLatestAfterConflict();
  if (!envelope) {
    banner.value = {
      tone: 'danger',
      title: 'Reload failed',
      message: loadError.value ?? undefined,
    };
    return;
  }
  banner.value = {
    tone: 'warning',
    title: 'Editor replaced with latest server version',
    message: `Now at v${envelope.version}. Previous conflicted edit was discarded by this reload.`,
  };
}

async function onAnalyze(): Promise<void> {
  banner.value = null;
  const draftArch = architectureText.value;
  const draftDoc = documentJson.value;
  const response = await analyze();
  if (!response) {
    architectureText.value = draftArch;
    documentJson.value = draftDoc;
    banner.value = {
      tone: 'danger',
      title: 'Analysis failed',
      message: analyzeError.value ?? undefined,
    };
    return;
  }
  banner.value = {
    tone:
      response.scenarioExtraction.status === 'UNSUPPORTED' ? 'warning' : 'success',
    title: `Scenario ${response.scenarioExtraction.status}`,
    message:
      response.simulation?.status
        ? `Simulation ${response.simulation.status}`
        : (response.scenarioExtraction.reason ?? undefined),
  };
}

async function onCompare(): Promise<void> {
  banner.value = null;
  const diff = await compare();
  if (!diff) {
    banner.value = {
      tone: 'danger',
      title: 'Diff failed',
      message: diffError.value ?? undefined,
    };
  }
}
</script>

<template>
  <div class="min-h-screen bg-canvas text-ink">
    <header class="border-b border-black/20 bg-header text-ink-on-dark">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <p class="text-xs uppercase tracking-wide text-ink-on-dark-muted">
            Deterministic analysis workspace
          </p>
          <h1 class="text-xl font-semibold">
            Architecture Reasoning Engine
          </h1>
        </div>
        <p class="max-w-md text-xs text-ink-on-dark-muted">
          LLMs extract and explain. Numbers come from the engine. Fake LLM is the default reproducible demo.
        </p>
      </div>
    </header>

    <main class="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-2">
      <div class="space-y-4">
        <StatusBanner
          v-if="banner"
          :tone="banner.tone"
          :title="banner.title"
          :message="banner.message"
        />
        <ArchitectureInputPanel
          v-model="architectureText"
          :loading="extractLoading"
          :error="extractError"
          @extract="onExtract"
          @load-demo="architectureText = DEMO_ARCHITECTURE_TEXT"
        />
        <ExtractedModelPanel :result="extractResult" />
        <JsonDocumentEditor
          :model-value="documentJson"
          :json-error="jsonError"
          :validate-loading="validateLoading"
          :persist-loading="persistLoading"
          :can-validate="canValidate"
          :can-persist="canPersist"
          :is-update="isUpdate"
          :expected-version="expectedVersion"
          :validate-error="validateError"
          :persist-error="persistError"
          :architecture-id="architectureId"
          :version="version"
          @update:model-value="onDocumentJsonInput"
          @validate="onValidate"
          @persist="onPersist"
        />
        <VersionPanel
          :load-id-input="loadIdInput"
          :architecture-id="architectureId"
          :version="version"
          :expected-version="expectedVersion"
          :versions="versions"
          :versions-loading="versionsLoading"
          :load-error="loadError"
          :conflict="conflict"
          @update:load-id-input="loadIdInput = $event"
          @load="onLoad"
          @select-version="onSelectVersion"
          @reload-latest="onReloadLatest"
        />
        <section
          v-if="findings.length"
          class="rounded-xl border border-border bg-panel p-4 text-sm shadow-sm"
        >
          <h2 class="mb-2 text-base font-semibold">
            Validation findings
          </h2>
          <ul class="space-y-1">
            <li v-for="(f, i) in findings" :key="i">
              <span class="font-mono text-xs">{{ f.severity }} · {{ f.code }}</span>
              — {{ f.message }}
            </li>
          </ul>
        </section>
      </div>

      <div class="space-y-4">
        <ScenarioPanel
          v-model="question"
          :loading="analyzeLoading"
          :can-analyze="canAnalyze"
          :error="analyzeError"
          :architecture-id="architectureId"
          :version="version"
          @analyze="onAnalyze"
          @load-load-question="question = DEMO_QUESTION_LOAD"
          @load-unsupported-question="question = DEMO_QUESTION_UNSUPPORTED"
        />
        <ResultsEvidencePanel :result="analyzeResult" />
        <DiffViewer
          :versions="versions"
          :from-version="fromVersion"
          :to-version="toVersion"
          :loading="diffLoading"
          :error="diffError"
          :result="diffResult"
          :disabled="!architectureId || versions.length < 1"
          @update:from-version="fromVersion = $event"
          @update:to-version="toVersion = $event"
          @compare="onCompare"
        />
        <UsageTimingPanel
          :usage="latestUsage"
          :timings-ms="analyzeResult?.timingsMs ?? null"
        />
      </div>
    </main>
  </div>
</template>
