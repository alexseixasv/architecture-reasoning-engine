import type {
  AnalyzeHttpResponse,
  ApiErrorBody,
  ArchitectureEnvelope,
  DocumentDiff,
  EvaluationRunResult,
  EvaluationSuiteId,
  EvaluationSuitesResponse,
  ExtractHttpResponse,
  HistoricalEvaluationResponse,
  ValidateResponse,
  VersionListResponse,
} from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

export class ApiClientError extends Error {
  readonly status: number;
  readonly errorClass: string | null;
  readonly body: unknown;

  constructor(input: {
    message: string;
    status: number;
    errorClass?: string | null;
    body?: unknown;
  }) {
    super(input.message);
    this.name = 'ApiClientError';
    this.status = input.status;
    this.errorClass = input.errorClass ?? null;
    this.body = input.body ?? null;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

function formatMessage(body: unknown, fallback: string): string {
  if (body === null || typeof body !== 'object') {
    return fallback;
  }
  const b = body as ApiErrorBody & { code?: string };
  if (typeof b.message === 'string' && b.message.trim()) {
    return b.message;
  }
  if (
    b.message !== null &&
    typeof b.message === 'object' &&
    !Array.isArray(b.message) &&
    typeof (b.message as { message?: unknown }).message === 'string'
  ) {
    return (b.message as { message: string }).message;
  }
  if (Array.isArray(b.message) && b.message.length > 0) {
    return b.message.map(String).join('; ');
  }
  if (typeof b.error === 'string' && b.error.trim()) {
    return b.error;
  }
  return fallback;
}

function extractErrorClass(body: unknown, status: number): string | null {
  if (body !== null && typeof body === 'object') {
    const b = body as ApiErrorBody & { code?: string };
    if (typeof b.errorClass === 'string' && b.errorClass.trim()) {
      return b.errorClass;
    }
    if (typeof b.code === 'string' && b.code.trim()) {
      return b.code;
    }
    if (
      b.message !== null &&
      typeof b.message === 'object' &&
      !Array.isArray(b.message)
    ) {
      const nested = b.message as { code?: unknown; errorClass?: unknown };
      if (typeof nested.errorClass === 'string') return nested.errorClass;
      if (typeof nested.code === 'string') return nested.code;
    }
  }
  if (status === 409) return 'VERSION_CONFLICT';
  if (status === 403) return 'FORBIDDEN';
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    throw new ApiClientError({
      message:
        err instanceof Error
          ? `Network error: ${err.message}`
          : 'Network error contacting the API',
      status: 0,
      errorClass: 'NETWORK_ERROR',
    });
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    const errorClass = extractErrorClass(body, response.status);
    throw new ApiClientError({
      message: formatMessage(
        body,
        `Request failed with HTTP ${response.status}`,
      ),
      status: response.status,
      errorClass,
      body,
    });
  }

  return body as T;
}

export type ChangeSource =
  | 'manual'
  | 'user_corrected'
  | 'approved_extraction';

export const api = {
  extract(architectureText: string): Promise<ExtractHttpResponse> {
    return request<ExtractHttpResponse>('/architectures/extract', {
      method: 'POST',
      body: JSON.stringify({ architectureText }),
    });
  },

  validate(document: unknown): Promise<ValidateResponse> {
    return request<ValidateResponse>('/architectures/validate', {
      method: 'POST',
      body: JSON.stringify({ document }),
    });
  },

  create(
    document: unknown,
    changeSource: ChangeSource = 'approved_extraction',
  ): Promise<ArchitectureEnvelope> {
    return request<ArchitectureEnvelope>('/architectures', {
      method: 'POST',
      body: JSON.stringify({ document, changeSource }),
    });
  },

  getLatest(architectureId: string): Promise<ArchitectureEnvelope> {
    return request<ArchitectureEnvelope>(
      `/architectures/${encodeURIComponent(architectureId)}`,
    );
  },

  listVersions(architectureId: string): Promise<VersionListResponse> {
    return request<VersionListResponse>(
      `/architectures/${encodeURIComponent(architectureId)}/versions`,
    );
  },

  getVersion(
    architectureId: string,
    version: number,
  ): Promise<ArchitectureEnvelope> {
    return request<ArchitectureEnvelope>(
      `/architectures/${encodeURIComponent(architectureId)}/versions/${version}`,
    );
  },

  update(
    architectureId: string,
    expectedVersion: number,
    document: unknown,
    changeSource: ChangeSource = 'user_corrected',
  ): Promise<ArchitectureEnvelope> {
    return request<ArchitectureEnvelope>(
      `/architectures/${encodeURIComponent(architectureId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ expectedVersion, document, changeSource }),
      },
    );
  },

  diff(
    architectureId: string,
    from: number,
    to: number,
  ): Promise<DocumentDiff> {
    const q = new URLSearchParams({
      from: String(from),
      to: String(to),
    });
    return request<DocumentDiff>(
      `/architectures/${encodeURIComponent(architectureId)}/diff?${q.toString()}`,
    );
  },

  analyze(
    architectureId: string,
    version: number,
    question: string,
  ): Promise<AnalyzeHttpResponse> {
    return request<AnalyzeHttpResponse>(
      `/architectures/${encodeURIComponent(architectureId)}/versions/${version}/analyze`,
      {
        method: 'POST',
        body: JSON.stringify({ question }),
      },
    );
  },

  health(): Promise<{ status: string; service: string; version: string }> {
    return request('/health');
  },

  listEvaluationSuites(): Promise<EvaluationSuitesResponse> {
    return request<EvaluationSuitesResponse>('/evaluation/suites');
  },

  runEvaluation(
    suiteId: EvaluationSuiteId = 'deterministic_full',
  ): Promise<EvaluationRunResult> {
    return request<EvaluationRunResult>('/evaluation/runs', {
      method: 'POST',
      body: JSON.stringify({ suiteId }),
    });
  },

  getHistoricalEvaluation(): Promise<HistoricalEvaluationResponse> {
    return request<HistoricalEvaluationResponse>('/evaluation/historical');
  },
};

export type ApiClient = typeof api;
