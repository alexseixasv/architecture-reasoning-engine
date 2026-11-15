import type { z } from 'zod';
import type {
  LlmProvider,
  StructuredParseRequest,
  StructuredParseResult,
} from './llm-provider';

export type FakeLlmHandler = (
  request: StructuredParseRequest<z.ZodType>,
) => Promise<StructuredParseResult<unknown>> | StructuredParseResult<unknown>;

/**
 * Offline provider. Handlers are registered by schemaName.
 * Default: SCHEMA_MISMATCH (forces explicit fixtures in tests).
 */
export class FakeLlmProvider implements LlmProvider {
  readonly name = 'fake';
  private readonly handlers = new Map<string, FakeLlmHandler>();
  private failure: StructuredParseResult<unknown> | null = null;

  setHandler(schemaName: string, handler: FakeLlmHandler): void {
    this.handlers.set(schemaName, handler);
  }

  /** Force next call to fail with this result (then clear). */
  failNext(result: StructuredParseFailureLike): void {
    this.failure = {
      ok: false,
      errorClass: result.errorClass,
      message: result.message,
      model: result.model ?? 'fake',
      inputTokens: result.inputTokens ?? 0,
      outputTokens: result.outputTokens ?? 0,
      totalTokens: result.totalTokens ?? 0,
      durationMs: result.durationMs ?? 1,
    };
  }

  async parseStructured<T extends z.ZodType>(
    request: StructuredParseRequest<T>,
  ): Promise<StructuredParseResult<z.infer<T>>> {
    if (this.failure !== null) {
      const fail = this.failure as StructuredParseResult<z.infer<T>>;
      this.failure = null;
      return fail;
    }

    const handler = this.handlers.get(request.schemaName);
    if (!handler) {
      return {
        ok: false,
        errorClass: 'SCHEMA_MISMATCH',
        message: `FakeLlmProvider: no handler for schema "${request.schemaName}"`,
        model: 'fake',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        durationMs: 1,
      };
    }

    const raw = await handler(request);
    if (!raw.ok) {
      return raw as StructuredParseResult<z.infer<T>>;
    }

    const parsed = request.schema.safeParse(raw.data);
    if (!parsed.success) {
      return {
        ok: false,
        errorClass: 'SCHEMA_MISMATCH',
        message: parsed.error.issues.map((i) => i.message).join('; '),
        model: 'fake',
        inputTokens: raw.inputTokens,
        outputTokens: raw.outputTokens,
        totalTokens: raw.totalTokens,
        durationMs: raw.durationMs,
      };
    }

    return {
      ok: true,
      data: parsed.data,
      model: raw.model,
      inputTokens: raw.inputTokens,
      outputTokens: raw.outputTokens,
      totalTokens: raw.totalTokens,
      durationMs: raw.durationMs,
      ...(raw.providerRequestId
        ? { providerRequestId: raw.providerRequestId }
        : {}),
    };
  }
}

type StructuredParseFailureLike = {
  errorClass: import('../errors').LlmErrorClass;
  message: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs?: number;
};
