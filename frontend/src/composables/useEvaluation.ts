import { computed, ref } from 'vue';
import type { ApiClient } from '@/api/client';
import { api, ApiClientError } from '@/api/client';
import type {
  EvaluationRunResult,
  EvaluationSuiteDescriptor,
  EvaluationSuiteId,
  HistoricalEvaluationResponse,
} from '@/api/types';

export type EvaluationUiError = {
  kind: 'disabled' | 'invalid_suite' | 'network' | 'http' | 'unknown';
  title: string;
  message: string;
  status: number | null;
  errorClass: string | null;
};

export function useEvaluation(client: ApiClient = api) {
  const suites = ref<EvaluationSuiteDescriptor[]>([]);
  const selectedSuiteId = ref<EvaluationSuiteId>('deterministic_full');
  const loadingSuites = ref(false);
  const running = ref(false);
  const loadingHistorical = ref(false);

  const runResult = ref<EvaluationRunResult | null>(null);
  const historical = ref<HistoricalEvaluationResponse | null>(null);

  const runError = ref<EvaluationUiError | null>(null);
  const suitesError = ref<EvaluationUiError | null>(null);
  const historicalError = ref<EvaluationUiError | null>(null);

  const canRun = computed(() => !running.value);

  function mapError(err: unknown, fallbackTitle: string): EvaluationUiError {
    if (err instanceof ApiClientError) {
      if (
        err.status === 403 ||
        err.errorClass === 'EVAL_LAB_DISABLED' ||
        err.errorClass === 'FORBIDDEN'
      ) {
        return {
          kind: 'disabled',
          title: 'Evaluation Lab disabled',
          message:
            err.message ||
            'Set EVAL_LAB_ENABLED=1 on the API in an approved development/demo environment, then retry.',
          status: err.status,
          errorClass: err.errorClass ?? 'EVAL_LAB_DISABLED',
        };
      }
      if (err.errorClass === 'INVALID_SUITE_ID' || err.status === 400) {
        return {
          kind: 'invalid_suite',
          title: 'Invalid suite',
          message: err.message,
          status: err.status,
          errorClass: err.errorClass,
        };
      }
      if (err.status === 0 || err.errorClass === 'NETWORK_ERROR') {
        return {
          kind: 'network',
          title: 'Backend unavailable',
          message: err.message,
          status: 0,
          errorClass: 'NETWORK_ERROR',
        };
      }
      return {
        kind: 'http',
        title: fallbackTitle,
        message: err.message,
        status: err.status,
        errorClass: err.errorClass,
      };
    }
    return {
      kind: 'unknown',
      title: fallbackTitle,
      message: err instanceof Error ? err.message : String(err),
      status: null,
      errorClass: null,
    };
  }

  async function loadSuites(): Promise<void> {
    loadingSuites.value = true;
    suitesError.value = null;
    try {
      const response = await client.listEvaluationSuites();
      suites.value = response.suites ?? [];
      if (
        !suites.value.some((s) => s.id === selectedSuiteId.value) &&
        suites.value[0]
      ) {
        selectedSuiteId.value = suites.value[0].id;
      }
    } catch (err) {
      suitesError.value = mapError(err, 'Failed to load suites');
      suites.value = [];
    } finally {
      loadingSuites.value = false;
    }
  }

  async function runSuite(): Promise<EvaluationRunResult | null> {
    if (running.value) {
      return null;
    }
    running.value = true;
    runError.value = null;
    try {
      const result = await client.runEvaluation(selectedSuiteId.value);
      runResult.value = result;
      return result;
    } catch (err) {
      runError.value = mapError(err, 'Evaluation run failed');
      // Preserve last successful report (do not clear runResult).
      return null;
    } finally {
      running.value = false;
    }
  }

  async function loadHistorical(): Promise<void> {
    loadingHistorical.value = true;
    historicalError.value = null;
    try {
      historical.value = await client.getHistoricalEvaluation();
    } catch (err) {
      historicalError.value = mapError(err, 'Failed to load historical evidence');
      historical.value = null;
    } finally {
      loadingHistorical.value = false;
    }
  }

  return {
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
    canRun,
    loadSuites,
    runSuite,
    loadHistorical,
  };
}
