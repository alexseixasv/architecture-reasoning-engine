import { computed, onUnmounted, ref } from 'vue';
import { api, ApiClientError, type ApiClient } from '@/api/client';
import type {
  ArchitectureEnvelope,
  ValidateResponse,
  ValidationFinding,
  VersionConflictInfo,
  VersionListItem,
} from '@/api/types';

/** Debounce for live JSON → POST /architectures/validate. */
export const LIVE_VALIDATE_DEBOUNCE_MS = 400;

function tryParseJson(
  text: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!text.trim()) {
    return { ok: false, error: 'Document JSON is empty.' };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid JSON',
    };
  }
}

function conflictFromError(err: ApiClientError): VersionConflictInfo {
  const body =
    err.body !== null && typeof err.body === 'object'
      ? (err.body as Record<string, unknown>)
      : {};
  return {
    message: err.message,
    architectureId:
      typeof body['architectureId'] === 'string'
        ? body['architectureId']
        : undefined,
    expectedVersion:
      typeof body['expectedVersion'] === 'number'
        ? body['expectedVersion']
        : undefined,
    actualVersion:
      typeof body['actualVersion'] === 'number'
        ? body['actualVersion']
        : undefined,
  };
}

export function useArchitectureSession(client: ApiClient = api) {
  const documentJson = ref('');
  const jsonError = ref<string | null>(null);
  const validation = ref<ValidateResponse | null>(null);
  const validateLoading = ref(false);
  const validateError = ref<string | null>(null);

  const architectureId = ref<string | null>(null);
  const version = ref<number | null>(null);
  /** Version the user began editing against (OCC base). */
  const expectedVersion = ref<number | null>(null);
  const versions = ref<VersionListItem[]>([]);
  const versionsLoading = ref(false);
  const loadError = ref<string | null>(null);

  const persistLoading = ref(false);
  const persistError = ref<string | null>(null);
  const saved = ref<ArchitectureEnvelope | null>(null);
  const conflict = ref<VersionConflictInfo | null>(null);

  const loadIdInput = ref('');

  let validateSeq = 0;
  let liveValidateTimer: ReturnType<typeof setTimeout> | undefined;

  const canValidate = computed(() => documentJson.value.trim().length > 0);

  const canPersist = computed(() => {
    if (!canValidate.value || jsonError.value) {
      return false;
    }
    if (validation.value && validation.value.canPersist === false) {
      return false;
    }
    return true;
  });

  const isUpdate = computed(
    () =>
      Boolean(architectureId.value) &&
      expectedVersion.value !== null &&
      expectedVersion.value >= 1,
  );

  function setDocumentFromUnknown(
    document: unknown,
    nextValidation?: ValidateResponse | null,
  ): void {
    documentJson.value = JSON.stringify(document, null, 2);
    jsonError.value = null;
    conflict.value = null;
    validation.value = nextValidation === undefined ? null : nextValidation;
    scheduleLiveValidate();
  }

  function clearLiveValidateTimer(): void {
    if (liveValidateTimer !== undefined) {
      clearTimeout(liveValidateTimer);
      liveValidateTimer = undefined;
    }
  }

  function scheduleLiveValidate(): void {
    clearLiveValidateTimer();
    liveValidateTimer = setTimeout(() => {
      liveValidateTimer = undefined;
      void validateDocument({ silent: true });
    }, LIVE_VALIDATE_DEBOUNCE_MS);
  }

  function onDocumentJsonInput(value: string): void {
    documentJson.value = value;
    const parsed = tryParseJson(value);
    jsonError.value = parsed.ok ? null : parsed.error;
    if (parsed.ok) {
      scheduleLiveValidate();
    } else {
      clearLiveValidateTimer();
    }
  }

  async function refreshVersions(id: string): Promise<void> {
    versionsLoading.value = true;
    try {
      const list = await client.listVersions(id);
      versions.value = list.versions;
    } finally {
      versionsLoading.value = false;
    }
  }

  async function validateDocument(options?: {
    silent?: boolean;
  }): Promise<ValidateResponse | null> {
    const silent = options?.silent === true;
    if (!silent) {
      validateError.value = null;
    }
    const parsed = tryParseJson(documentJson.value);
    if (!parsed.ok) {
      jsonError.value = parsed.error;
      if (!silent) {
        validateError.value = `Invalid JSON: ${parsed.error}`;
      }
      return null;
    }
    jsonError.value = null;
    const seq = ++validateSeq;
    if (!silent) {
      validateLoading.value = true;
    }
    try {
      const response = await client.validate(parsed.value);
      if (seq !== validateSeq) {
        return response;
      }
      validation.value = response;
      if (!silent) {
        validateError.value = null;
      }
      return response;
    } catch (err) {
      if (seq !== validateSeq) {
        return null;
      }
      if (!silent) {
        validateError.value =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Validation request failed';
      }
      return null;
    } finally {
      if (!silent && seq === validateSeq) {
        validateLoading.value = false;
      }
    }
  }

  /**
   * Create v1 when no id; otherwise OCC update with expectedVersion.
   * Never auto-retries with a newer expectedVersion after 409.
   */
  async function persist(): Promise<ArchitectureEnvelope | null> {
    persistError.value = null;
    conflict.value = null;
    const draftBefore = documentJson.value;
    const parsed = tryParseJson(documentJson.value);
    if (!parsed.ok) {
      jsonError.value = parsed.error;
      persistError.value = `Invalid JSON: ${parsed.error}`;
      return null;
    }
    jsonError.value = null;
    persistLoading.value = true;
    try {
      let envelope: ArchitectureEnvelope;
      if (
        architectureId.value &&
        expectedVersion.value !== null &&
        expectedVersion.value >= 1
      ) {
        envelope = await client.update(
          architectureId.value,
          expectedVersion.value,
          parsed.value,
          'user_corrected',
        );
      } else {
        envelope = await client.create(parsed.value, 'approved_extraction');
      }
      saved.value = envelope;
      architectureId.value = envelope.architectureId;
      loadIdInput.value = envelope.architectureId;
      version.value = envelope.version;
      expectedVersion.value = envelope.version;
      documentJson.value = JSON.stringify(envelope.document, null, 2);
      await refreshVersions(envelope.architectureId);
      return envelope;
    } catch (err) {
      documentJson.value = draftBefore;
      if (err instanceof ApiClientError && err.isConflict) {
        conflict.value = conflictFromError(err);
        persistError.value = err.message;
        return null;
      }
      persistError.value =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Persist failed';
      return null;
    } finally {
      persistLoading.value = false;
    }
  }

  async function loadById(rawId?: string): Promise<ArchitectureEnvelope | null> {
    loadError.value = null;
    conflict.value = null;
    const id = (rawId ?? loadIdInput.value).trim();
    if (!id) {
      loadError.value = 'Enter an architecture ID to load.';
      return null;
    }
    versionsLoading.value = true;
    try {
      const latest = await client.getLatest(id);
      architectureId.value = latest.architectureId;
      loadIdInput.value = latest.architectureId;
      version.value = latest.version;
      expectedVersion.value = latest.version;
      setDocumentFromUnknown(latest.document);
      saved.value = latest;
      await refreshVersions(latest.architectureId);
      return latest;
    } catch (err) {
      loadError.value =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load architecture';
      return null;
    } finally {
      versionsLoading.value = false;
    }
  }

  async function selectVersion(
    target: number,
  ): Promise<ArchitectureEnvelope | null> {
    loadError.value = null;
    conflict.value = null;
    if (!architectureId.value) {
      loadError.value = 'No architecture loaded.';
      return null;
    }
    const draftBefore = documentJson.value;
    try {
      const envelope = await client.getVersion(architectureId.value, target);
      version.value = envelope.version;
      expectedVersion.value = envelope.version;
      setDocumentFromUnknown(envelope.document);
      saved.value = envelope;
      return envelope;
    } catch (err) {
      documentJson.value = draftBefore;
      loadError.value =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load version';
      return null;
    }
  }

  /** Reload latest after OCC conflict — replaces editor with server latest. */
  async function reloadLatestAfterConflict(): Promise<ArchitectureEnvelope | null> {
    if (!architectureId.value) {
      return null;
    }
    return loadById(architectureId.value);
  }

  const findings = computed<ValidationFinding[]>(() => {
    return validation.value?.findings ?? saved.value?.findings ?? [];
  });

  onUnmounted(() => {
    validateSeq += 1;
    clearLiveValidateTimer();
  });

  return {
    documentJson,
    jsonError,
    validation,
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
    saved,
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
    refreshVersions,
    reloadLatestAfterConflict,
  };
}
