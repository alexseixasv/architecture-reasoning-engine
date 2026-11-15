import { computed, ref, type Ref } from 'vue';
import { api, ApiClientError, type ApiClient } from '@/api/client';
import type { AnalyzeHttpResponse, UsageSummary } from '@/api/types';

export function useAnalysis(
  architectureId: Ref<string | null>,
  version: Ref<number | null>,
  client: ApiClient = api,
) {
  const question = ref('');
  const loading = ref(false);
  const error = ref<string | null>(null);
  const result = ref<AnalyzeHttpResponse | null>(null);
  const usage = ref<UsageSummary | null>(null);

  const canAnalyze = computed(
    () =>
      Boolean(architectureId.value) &&
      version.value !== null &&
      question.value.trim().length > 0,
  );

  async function analyze(): Promise<AnalyzeHttpResponse | null> {
    error.value = null;
    if (!architectureId.value || version.value === null) {
      error.value =
        'Persist an architecture version before running scenario analysis.';
      return null;
    }
    if (!question.value.trim()) {
      error.value = 'Enter a natural-language question.';
      return null;
    }
    loading.value = true;
    try {
      const response = await client.analyze(
        architectureId.value,
        version.value,
        question.value,
      );
      result.value = response;
      usage.value = response.usage;
      return response;
    } catch (err) {
      error.value =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Analysis failed';
      return null;
    } finally {
      loading.value = false;
    }
  }

  return {
    question,
    loading,
    error,
    result,
    usage,
    canAnalyze,
    analyze,
  };
}
