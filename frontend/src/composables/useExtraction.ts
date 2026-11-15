import { ref } from 'vue';
import { api, ApiClientError, type ApiClient } from '@/api/client';
import type { ExtractHttpResponse, UsageSummary } from '@/api/types';
import { prettyJson } from '@/lib/format';

export function useExtraction(client: ApiClient = api) {
  const architectureText = ref('');
  const loading = ref(false);
  const error = ref<string | null>(null);
  const result = ref<ExtractHttpResponse | null>(null);
  const usage = ref<UsageSummary | null>(null);

  async function extract(): Promise<ExtractHttpResponse | null> {
    error.value = null;
    if (!architectureText.value.trim()) {
      error.value = 'Enter an architecture description before extracting.';
      return null;
    }
    loading.value = true;
    try {
      const response = await client.extract(architectureText.value);
      result.value = response;
      usage.value = response.usage;
      return response;
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Extraction failed';
      error.value = message;
      return null;
    } finally {
      loading.value = false;
    }
  }

  function documentJsonFromResult(): string | null {
    if (!result.value?.document) {
      return null;
    }
    return prettyJson(result.value.document);
  }

  return {
    architectureText,
    loading,
    error,
    result,
    usage,
    extract,
    documentJsonFromResult,
  };
}
