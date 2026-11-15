import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import type { LlmConfig } from '../config';
import { requireOpenAiKey } from '../config';
import { LlmError, sanitizeForLog } from '../errors';
import type {
  LlmProvider,
  StructuredParseRequest,
  StructuredParseResult,
} from './llm-provider';

export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: LlmConfig, client?: OpenAI) {
    const apiKey = requireOpenAiKey(config);
    this.model = config.openaiModel;
    this.client =
      client ??
      new OpenAI({
        apiKey,
        timeout: config.openaiTimeoutMs,
        maxRetries: 0,
      });
  }

  async parseStructured<T extends z.ZodType>(
    request: StructuredParseRequest<T>,
  ): Promise<StructuredParseResult<z.infer<T>>> {
    const started = Date.now();
    try {
      const response = await this.client.responses.parse({
        model: this.model,
        input: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userContent },
        ],
        text: {
          format: zodTextFormat(request.schema, request.schemaName),
        },
      });

      const durationMs = Date.now() - started;
      const usage = response.usage;
      const inputTokens = usage?.input_tokens ?? 0;
      const outputTokens = usage?.output_tokens ?? 0;
      const totalTokens = usage?.total_tokens ?? inputTokens + outputTokens;
      const providerRequestId = response.id;

      if (response.status === 'incomplete') {
        return {
          ok: false,
          errorClass: 'PROVIDER_INCOMPLETE',
          message: 'OpenAI response incomplete',
          model: this.model,
          providerRequestId,
          inputTokens,
          outputTokens,
          totalTokens,
          durationMs,
        };
      }

      // Safety refusals are detectable on Responses API outputs
      const refused = response.output?.some(
        (item) =>
          item.type === 'message' &&
          Array.isArray(item.content) &&
          item.content.some(
            (c) =>
              typeof c === 'object' &&
              c !== null &&
              'type' in c &&
              (c as { type: string }).type === 'refusal',
          ),
      );
      if (refused) {
        return {
          ok: false,
          errorClass: 'MODEL_REFUSAL',
          message: 'Model refused to produce structured output',
          model: this.model,
          providerRequestId,
          inputTokens,
          outputTokens,
          totalTokens,
          durationMs,
        };
      }

      if (response.output_parsed == null) {
        return {
          ok: false,
          errorClass: 'SCHEMA_MISMATCH',
          message: 'No parsed structured output from OpenAI',
          model: this.model,
          providerRequestId,
          inputTokens,
          outputTokens,
          totalTokens,
          durationMs,
        };
      }

      return {
        ok: true,
        data: response.output_parsed as z.infer<T>,
        model: this.model,
        providerRequestId,
        inputTokens,
        outputTokens,
        totalTokens,
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - started;
      return mapOpenAiError(err, this.model, durationMs);
    }
  }
}

function mapOpenAiError(
  err: unknown,
  model: string,
  durationMs: number,
): StructuredParseResult<never> {
  const message = sanitizeForLog(
    err instanceof Error ? err.message : String(err),
  );

  if (err instanceof LlmError) {
    return {
      ok: false,
      errorClass: err.errorClass,
      message: sanitizeForLog(err.message),
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      durationMs,
    };
  }

  const status =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
      ? (err as { status: number }).status
      : undefined;

  if (
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('timed out')
  ) {
    return {
      ok: false,
      errorClass: 'PROVIDER_TIMEOUT',
      message,
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      durationMs,
    };
  }

  if (status === 401 || status === 403) {
    return {
      ok: false,
      errorClass: 'PROVIDER_CONFIG_ERROR',
      message: 'Invalid OpenAI credentials',
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      durationMs,
    };
  }

  if (status === 429 || (status !== undefined && status >= 500)) {
    return {
      ok: false,
      errorClass: 'PROVIDER_UNAVAILABLE',
      message,
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      durationMs,
    };
  }

  return {
    ok: false,
    errorClass: 'INTERNAL_ERROR',
    message,
    model,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    durationMs,
  };
}
