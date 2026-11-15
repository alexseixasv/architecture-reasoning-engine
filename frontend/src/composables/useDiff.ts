import { ref, type Ref } from 'vue';
import { api, ApiClientError, type ApiClient } from '@/api/client';
import type { DocumentDiff } from '@/api/types';

export function useDiff(
  architectureId: Ref<string | null>,
  client: ApiClient = api,
) {
  const fromVersion = ref<number | null>(null);
  const toVersion = ref<number | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const result = ref<DocumentDiff | null>(null);

  async function compare(
    from?: number | null,
    to?: number | null,
  ): Promise<DocumentDiff | null> {
    error.value = null;
    result.value = null;
    const id = architectureId.value;
    const f = from ?? fromVersion.value;
    const t = to ?? toVersion.value;
    if (!id) {
      error.value = 'Load a persisted architecture before comparing versions.';
      return null;
    }
    if (f === null || t === null || !Number.isInteger(f) || !Number.isInteger(t)) {
      error.value = 'Select integer from/to versions.';
      return null;
    }
    loading.value = true;
    try {
      const diff = await client.diff(id, f, t);
      result.value = diff;
      fromVersion.value = f;
      toVersion.value = t;
      return diff;
    } catch (err) {
      error.value =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Diff failed';
      return null;
    } finally {
      loading.value = false;
    }
  }

  return {
    fromVersion,
    toVersion,
    loading,
    error,
    result,
    compare,
  };
}
